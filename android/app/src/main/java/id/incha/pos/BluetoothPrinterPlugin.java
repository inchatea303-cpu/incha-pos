package id.incha.pos;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            },
            alias = "bluetooth"
        )
    }
)
public class BluetoothPrinterPlugin extends Plugin {

    private static final String TAG = "InchaBTPrinter";
    // Universal Serial Port Profile (SPP) UUID for thermal ESC/POS printers (RPP02N, EPPOS, ZJ-58, dll)
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    // Multi-Printer Slots: Slot 1 (Struk Kasir) dan Slot 2 (Stiker Cup EPPOS)
    private static class PrinterSlot {
        BluetoothSocket socket = null;
        OutputStream stream = null;
        String address = null;
        String name = null;

        boolean isConnected() {
            return socket != null && socket.isConnected() && stream != null;
        }

        void disconnect() {
            try {
                if (stream != null) stream.close();
            } catch (Exception ignored) {}
            try {
                if (socket != null) socket.close();
            } catch (Exception ignored) {}
            stream = null;
            socket = null;
        }
    }

    private final PrinterSlot receiptSlot = new PrinterSlot();
    private final PrinterSlot labelSlot = new PrinterSlot();

    private PrinterSlot getSlot(String target) {
        if ("label".equalsIgnoreCase(target)) {
            return labelSlot;
        }
        return receiptSlot;
    }

    @PluginMethod
    public void listPrinters(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
                requestPermissionForAlias("bluetooth", call, "listPrintersCallback");
                return;
            }
        }
        executeListPrinters(call);
    }

    @PermissionCallback
    private void listPrintersCallback(PluginCall call) {
        if (getPermissionState("bluetooth") == PermissionState.GRANTED) {
            executeListPrinters(call);
        } else {
            call.reject("Izin 'Perangkat di sekitar' ditolak. Silakan izinkan di Pengaturan HP agar printer bisa terhubung.");
        }
    }

    private void executeListPrinters(PluginCall call) {
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("Perangkat ini tidak memiliki Bluetooth.");
                return;
            }

            if (!adapter.isEnabled()) {
                call.reject("Bluetooth tidak aktif. Silakan nyalakan Bluetooth HP terlebih dahulu.");
                return;
            }

            Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
            JSArray array = new JSArray();

            if (pairedDevices != null) {
                for (BluetoothDevice device : pairedDevices) {
                    JSObject dev = new JSObject();
                    String name = device.getName() != null ? device.getName() : "Printer Bluetooth";
                    dev.put("name", name);
                    dev.put("address", device.getAddress());
                    array.put(dev);
                }
            }

            JSObject ret = new JSObject();
            ret.put("printers", array);
            call.resolve(ret);
        } catch (SecurityException se) {
            call.reject("Izin Bluetooth ditolak sistem: " + se.getMessage());
        } catch (Exception e) {
            call.reject("Gagal mendapatkan daftar printer: " + e.getMessage());
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
                requestPermissionForAlias("bluetooth", call, "connectCallback");
                return;
            }
        }
        executeConnect(call);
    }

    @PermissionCallback
    private void connectCallback(PluginCall call) {
        if (getPermissionState("bluetooth") == PermissionState.GRANTED) {
            executeConnect(call);
        } else {
            call.reject("Izin Bluetooth ditolak.");
        }
    }

    private void executeConnect(PluginCall call) {
        String address = call.getString("address");
        String target = call.getString("target", "receipt");
        PrinterSlot slot = getSlot(target);

        if (address == null || address.trim().isEmpty()) {
            call.reject("Alamat printer tidak boleh kosong.");
            return;
        }

        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                call.reject("Bluetooth tidak aktif di tablet/HP. Silakan nyalakan Bluetooth.");
                return;
            }

            // Putuskan koneksi lama di slot ini jika ada
            slot.disconnect();

            BluetoothDevice device = adapter.getRemoteDevice(address);
            if (adapter.isDiscovering()) {
                adapter.cancelDiscovery();
            }

            // Beri jeda 150ms agar stack Bluetooth stabil
            try { Thread.sleep(150); } catch (Exception ignored) {}

            BluetoothSocket socket = openSocket(device);

            if (socket == null || !socket.isConnected()) {
                call.reject("Gagal tersambung ke printer (" + (device.getName() != null ? device.getName() : address) + "). Pastikan printer menyala.");
                return;
            }

            slot.socket = socket;
            slot.stream = socket.getOutputStream();
            slot.address = address;
            slot.name = device.getName() != null ? device.getName() : ("label".equalsIgnoreCase(target) ? "EPPOS Label" : "RPP02N");

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("target", target);
            ret.put("name", slot.name);
            ret.put("address", slot.address);
            call.resolve(ret);
        } catch (SecurityException se) {
            call.reject("Izin Bluetooth diperlukan: " + se.getMessage());
        } catch (Exception e) {
            call.reject("Koneksi printer gagal: " + e.getMessage());
        }
    }

    @PluginMethod
    public synchronized void printBytes(PluginCall call) {
        String base64 = call.getString("base64");
        String target = call.getString("target", "receipt");
        String forcedAddress = call.getString("address");
        PrinterSlot slot = getSlot(target);

        if (forcedAddress != null && !forcedAddress.trim().isEmpty()) {
            slot.address = forcedAddress;
        }

        if (base64 == null || base64.isEmpty()) {
            call.reject("Data cetak tidak boleh kosong.");
            return;
        }

        byte[] bytes;
        try {
            bytes = Base64.decode(base64, Base64.DEFAULT);
        } catch (Exception e) {
            call.reject("Format data cetak tidak valid: " + e.getMessage());
            return;
        }

        // 1. Pastikan koneksi aktif (pulihkan otomatis jika socket tertutup/sleep)
        ensureConnected(slot);

        if (!slot.isConnected()) {
            String targetLabel = "label".equalsIgnoreCase(target) ? "Printer Stiker Cup (EPPOS)" : "Printer Struk Kasir";
            call.reject(targetLabel + " belum tersambung. Silakan sambungkan di Pengaturan Printer.");
            return;
        }

        // 2. Percobaan tulis pertama ke stream
        boolean success = writeToStream(slot, bytes);

        // 3. Jika gagal (misal Broken pipe karena printer sempat idle/sleep) -> Reconnect otomatis dan coba lagi
        if (!success) {
            Log.w(TAG, "Pengiriman data ke " + target + " gagal (Broken pipe/socket reset). Mencoba reconnect otomatis...");
            slot.disconnect();
            try { Thread.sleep(250); } catch (Exception ignored) {}
            ensureConnected(slot);

            if (slot.isConnected()) {
                success = writeToStream(slot, bytes);
            }
        }

        if (success) {
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("target", target);
            call.resolve(ret);
        } else {
            String targetLabel = "label".equalsIgnoreCase(target) ? "Printer Stiker Cup (EPPOS)" : "Printer Struk Kasir";
            call.reject("Gagal mengirim data ke " + targetLabel + " (Koneksi terputus). Pastikan printer menyala.");
        }
    }

    private synchronized void ensureConnected(PrinterSlot slot) {
        if (slot.isConnected()) {
            return;
        }
        if (slot.address == null || slot.address.trim().isEmpty()) {
            return;
        }

        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                return;
            }
            if (adapter.isDiscovering()) {
                adapter.cancelDiscovery();
            }
            try { Thread.sleep(150); } catch (Exception ignored) {}

            BluetoothDevice device = adapter.getRemoteDevice(slot.address);
            BluetoothSocket socket = openSocket(device);
            if (socket != null && socket.isConnected()) {
                slot.socket = socket;
                slot.stream = socket.getOutputStream();
                if (slot.name == null || slot.name.isEmpty()) {
                    try {
                        slot.name = device.getName();
                    } catch (SecurityException ignored) {}
                }
                Log.i(TAG, "Koneksi berhasil dipulihkan otomatis ke " + slot.name + " (" + slot.address + ")");
            }
        } catch (Exception e) {
            Log.w(TAG, "Gagal memulihkan koneksi ke " + slot.address + ": " + e.getMessage());
        }
    }

    private synchronized boolean writeToStream(PrinterSlot slot, byte[] bytes) {
        if (slot.stream == null) {
            return false;
        }
        try {
            slot.stream.write(bytes);
            slot.stream.flush();
            return true;
        } catch (IOException e) {
            Log.w(TAG, "Write error pada " + slot.name + ": " + e.getMessage());
            return false;
        }
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        String target = call.getString("target", "receipt");
        PrinterSlot slot = getSlot(target);

        JSObject ret = new JSObject();
        ret.put("connected", slot.isConnected());
        ret.put("name", slot.name);
        ret.put("address", slot.address);

        ret.put("receiptConnected", receiptSlot.isConnected());
        ret.put("receiptName", receiptSlot.name);
        ret.put("receiptAddress", receiptSlot.address);

        ret.put("labelConnected", labelSlot.isConnected());
        ret.put("labelName", labelSlot.name);
        ret.put("labelAddress", labelSlot.address);

        call.resolve(ret);
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        String target = call.getString("target", "all");
        if ("all".equalsIgnoreCase(target)) {
            receiptSlot.disconnect();
            labelSlot.disconnect();
        } else if ("label".equalsIgnoreCase(target)) {
            labelSlot.disconnect();
        } else {
            receiptSlot.disconnect();
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestBluetoothPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
                requestPermissionForAlias("bluetooth", call, "permissionOnlyCallback");
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PermissionCallback
    private void permissionOnlyCallback(PluginCall call) {
        boolean granted = getPermissionState("bluetooth") == PermissionState.GRANTED;
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", getActivity().getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal membuka pengaturan: " + e.getMessage());
        }
    }

    // Helper koneksi socket dengan 4 fallback methods anti-gagal
    private BluetoothSocket openSocket(BluetoothDevice device) {
        BluetoothSocket socket = null;

        // METODE 1: Insecure RFCOMM Socket SPP
        try {
            socket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            return socket;
        } catch (Exception e1) {
            Log.w(TAG, "Metode 1 (Insecure SPP) gagal: " + e1.getMessage());
            try { if (socket != null) socket.close(); } catch (Exception ignored) {}
            socket = null;
        }

        // METODE 2: Insecure RFCOMM Channel 1 via Reflection
        try {
            Method m = device.getClass().getMethod("createInsecureRfcommSocket", new Class[] { int.class });
            socket = (BluetoothSocket) m.invoke(device, 1);
            if (socket != null) {
                socket.connect();
                return socket;
            }
        } catch (Exception e2) {
            Log.w(TAG, "Metode 2 (Insecure Channel 1) gagal: " + e2.getMessage());
            try { if (socket != null) socket.close(); } catch (Exception ignored) {}
            socket = null;
        }

        // METODE 3: Secure RFCOMM SPP
        try {
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            return socket;
        } catch (Exception e3) {
            Log.w(TAG, "Metode 3 (Secure SPP) gagal: " + e3.getMessage());
            try { if (socket != null) socket.close(); } catch (Exception ignored) {}
            socket = null;
        }

        // METODE 4: Secure RFCOMM Channel 1 via Reflection
        try {
            Method m = device.getClass().getMethod("createRfcommSocket", new Class[] { int.class });
            socket = (BluetoothSocket) m.invoke(device, 1);
            if (socket != null) {
                socket.connect();
                return socket;
            }
        } catch (Exception e4) {
            Log.w(TAG, "Metode 4 (Secure Channel 1) gagal: " + e4.getMessage());
            try { if (socket != null) socket.close(); } catch (Exception ignored) {}
            socket = null;
        }

        return null;
    }
}
