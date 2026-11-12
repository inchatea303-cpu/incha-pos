package id.incha.pos;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public class QrisPollerService extends Service {
    private static final String TAG = "QrisPollerService";
    private static final String CHANNEL_ID = "incha_qris_channel";
    private static final int NOTIF_ID = 9001;
    private static final String PREFS_NAME = "incha_qris_prefs";
    private static final String KEY_SEEN_SNS = "seen_order_sns";
    private static final String KEY_HAS_SEEDED = "has_seeded";

    private static final String AUTOGOPAY_BASE = "https://v1-gateway.autogopay.site";
    private static final String API_KEY = "agp_ef64a0883a18b3278bac8349ea5032f6bb07fbd47e31f58a88ccfd296d7b228b";
    private static final long POLL_INTERVAL_MS = 3000; // 3 detik

    private Handler handler;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private Set<String> seenOrderSns = new HashSet<>();
    private boolean hasSeeded = false;
    private SharedPreferences prefs;
    private boolean isPolling = false;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "QrisPollerService started");
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        loadSeenSns();

        // Inisialisasi TTS fallback
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int result = tts.setLanguage(new Locale("id", "ID"));
                if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts.setLanguage(Locale.getDefault());
                }
                ttsReady = true;
                Log.d(TAG, "TTS initialized OK");
            }
        });

        createNotificationChannel();
        startForeground(NOTIF_ID, buildPersistentNotification("Memantau pembayaran QRIS ShopeePay..."));

        handler = new Handler(Looper.getMainLooper());
        scheduleNextPoll();
    }

    private final Runnable pollRunnable = new Runnable() {
        @Override
        public void run() {
            doPollAsync();
            handler.postDelayed(this, POLL_INTERVAL_MS);
        }
    };

    private void scheduleNextPoll() {
        handler.postDelayed(pollRunnable, 1000);
    }

    private void doPollAsync() {
        if (isPolling) return;
        isPolling = true;
        new Thread(() -> {
            try {
                String urlStr = AUTOGOPAY_BASE + "/shopeepay/transactions";
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("x-api-key", API_KEY);
                conn.setRequestProperty("Accept", "application/json");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);

                int code = conn.getResponseCode();
                if (code != 200) {
                    isPolling = false;
                    return;
                }

                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();
                conn.disconnect();

                JSONObject json = new JSONObject(sb.toString());
                if (!json.optBoolean("success", false)) {
                    isPolling = false;
                    return;
                }

                JSONArray transactions = json.getJSONObject("data").getJSONArray("transactions");

                boolean isFirstSeed = !hasSeeded && seenOrderSns.isEmpty();

                for (int i = 0; i < transactions.length(); i++) {
                    JSONObject tx = transactions.getJSONObject(i);
                    String orderSn = tx.optString("order_sn", "");
                    int amount = tx.optInt("amount", 0);
                    boolean isMoneyIn = tx.optBoolean("is_money_in", false);

                    if (orderSn.isEmpty()) continue;
                    if (seenOrderSns.contains(orderSn)) continue;

                    seenOrderSns.add(orderSn);
                    saveSeenSns();

                    if (!isFirstSeed && isMoneyIn && amount > 0) {
                        final int finalAmount = amount;
                        Log.d(TAG, "NEW PAYMENT: Rp " + finalAmount);
                        handler.post(() -> announcePayment(finalAmount));
                    }
                }

                hasSeeded = true;
                prefs.edit().putBoolean(KEY_HAS_SEEDED, true).apply();

            } catch (Exception e) {
                Log.w(TAG, "Poll error: " + e.getMessage());
            } finally {
                isPolling = false;
            }
        }).start();
    }

    private void announcePayment(int amount) {
        String nominal = terbilangRupiah(amount);
        String ttsText = "Pembayaran ShopeePay QRIS sebesar " + nominal + " telah diterima";
        String notifText = "💰 Masuk Rp " + formatRupiah(amount);

        // Update persistent notification
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTIF_ID, buildPersistentNotification(notifText));

        // Show popup notification
        showPaymentNotification(amount, nominal);

        // Play natural MP3 voice first, fallback ke TTS Android
        playNaturalVoice(ttsText);
    }

    private void playNaturalVoice(String text) {
        try {
            String ttsUrl = "https://incha-pos.vercel.app/api/tts?text=" + Uri.encode(text);
            MediaPlayer mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build());
            mp.setDataSource(ttsUrl);
            mp.setOnPreparedListener(MediaPlayer::start);
            mp.setOnCompletionListener(MediaPlayer::release);
            mp.setOnErrorListener((player, what, extra) -> {
                Log.w(TAG, "MediaPlayer error " + what + ", falling back to TTS");
                player.release();
                speakFallback(text);
                return true;
            });
            mp.prepareAsync();
        } catch (Exception e) {
            Log.w(TAG, "Voice play error: " + e.getMessage());
            speakFallback(text);
        }
    }

    private void speakFallback(String text) {
        if (ttsReady && tts != null) {
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "qris_tts");
        }
    }

    private void showPaymentNotification(int amount, String nominal) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, openIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Notification notif = new NotificationCompat.Builder(this, CHANNEL_ID + "_pay")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("💰 Pembayaran ShopeePay QRIS Masuk!")
                .setContentText("Sebesar " + nominal + " (" + formatRupiah(amount) + ") telah diterima")
                .setStyle(new NotificationCompat.BigTextStyle()
                        .bigText("Pembayaran ShopeePay QRIS sebesar " + nominal + " (" + formatRupiah(amount) + ") telah diterima."))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setVibrate(new long[]{0, 300, 100, 300})
                .build();

        nm.notify((int) System.currentTimeMillis(), notif);
    }

    private Notification buildPersistentNotification(String text) {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, openIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_silent_mode_off)
                .setContentTitle("INCHA POS – Monitor QRIS")
                .setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
    }

    private void createNotificationChannel() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        // Channel untuk status monitor (persistent)
        NotificationChannel monitorCh = new NotificationChannel(
                CHANNEL_ID, "Monitor Pembayaran QRIS", NotificationManager.IMPORTANCE_LOW);
        monitorCh.setDescription("Notifikasi status monitor QRIS AutoGoPay");
        nm.createNotificationChannel(monitorCh);

        // Channel untuk notifikasi pembayaran masuk (high priority + sound)
        NotificationChannel payCh = new NotificationChannel(
                CHANNEL_ID + "_pay", "Pembayaran QRIS Masuk", NotificationManager.IMPORTANCE_HIGH);
        payCh.setDescription("Notifikasi saat ada transfer ShopeePay QRIS masuk");
        payCh.enableVibration(true);
        payCh.setVibrationPattern(new long[]{0, 300, 100, 300});
        nm.createNotificationChannel(payCh);
    }

    private void loadSeenSns() {
        hasSeeded = prefs.getBoolean(KEY_HAS_SEEDED, false);
        Set<String> stored = prefs.getStringSet(KEY_SEEN_SNS, new HashSet<>());
        seenOrderSns = new HashSet<>(stored);
    }

    private void saveSeenSns() {
        prefs.edit().putStringSet(KEY_SEEN_SNS, seenOrderSns).apply();
    }

    private String formatRupiah(int amount) {
        return "Rp " + String.format("%,d", amount).replace(',', '.');
    }

    private String terbilangRupiah(int nominal) {
        if (nominal <= 0) return "nol rupiah";
        return convert(nominal) + " rupiah";
    }

    private String convert(int n) {
        String[] satuan = {"", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"};
        if (n < 12) return satuan[n];
        if (n < 20) return convert(n - 10) + " belas";
        if (n < 100) {
            String sisa = n % 10 != 0 ? " " + convert(n % 10) : "";
            return convert(n / 10) + " puluh" + sisa;
        }
        if (n < 200) return "seratus" + (n > 100 ? " " + convert(n - 100) : "");
        if (n < 1000) {
            String sisa = n % 100 != 0 ? " " + convert(n % 100) : "";
            return convert(n / 100) + " ratus" + sisa;
        }
        if (n < 2000) return "seribu" + (n > 1000 ? " " + convert(n - 1000) : "");
        if (n < 1000000) {
            String sisa = n % 1000 != 0 ? " " + convert(n % 1000) : "";
            return convert(n / 1000) + " ribu" + sisa;
        }
        if (n < 1000000000) {
            String sisa = n % 1000000 != 0 ? " " + convert(n % 1000000) : "";
            return convert(n / 1000000) + " juta" + sisa;
        }
        return String.valueOf(n);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY; // Restart otomatis jika dimatikan sistem
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (handler != null) handler.removeCallbacks(pollRunnable);
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        Log.d(TAG, "QrisPollerService destroyed");
    }
}
