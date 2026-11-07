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
    // Universal Serial Port Profile (SPP) UUID for thermal ESC/POS printers (RPP02N, ZJ-58, etc.)
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothSocket connectedSocket = null;
    private OutputStream outputStream = null;
    private String connectedAddress = null;
    private String connectedName = null;

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

            // Putuskan koneksi lama jika ada
            disconnectInternal();

            BluetoothDevice device = adapter.getRemoteDevice(address);
            if (adapter.isDiscovering()) {
                adapter.cancelDiscovery();
            }

            // Beri jeda 200ms agar stack Bluetooth Android stabil
            try { Thread.sleep(200); } catch (Exception ignored) {}

            BluetoothSocket socket = null;
            Exception lastError = null;

            // METODE 1: Insecure RFCOMM Socket (Standar mutlak untuk printer thermal Bluetooth seperti RPP02N)
            try {
                Log.d(TAG, "Mencoba Metode 1: createInsecureRfcommSocketToServiceRecord...");
                socket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                socket.connect();
            } catch (Exception e1) {
                lastError = e1;
                Log.w(TAG, "Metode 1 (Insecure SPP) gagal: " + e1.getMessage());
                try { if (socket != null) socket.close(); } catch (Exception ignored) {}
                socket = null;
            }

            // METODE 2: Insecure RFCOMM Channel 1 via Reflection
            if (socket == null || !socket.isConnected()) {
                try {
                    Log.d(TAG, "Mencoba Metode 2: createInsecureRfcommSocket Channel 1...");
                    Method m = device.getClass().getMethod("createInsecureRfcommSocket", new Class[] { int.class });
                    socket = (BluetoothSocket) m.invoke(device, 1);
                    if (socket != null) {
                        socket.connect();
                    }
                } catch (Exception e2) {
                    lastError = e2;
                    Log.w(TAG, "Metode 2 (Insecure Channel 1) gagal: " + e2.getMessage());
                    try { if (socket != null) socket.close(); } catch (Exception ignored) {}
                    socket = null;
                }
            }

            // METODE 3: Secure RFCOMM SPP (Fallback)
            if (socket == null || !socket.isConnected()) {
                try {
                    Log.d(TAG, "Mencoba Metode 3: createRfcommSocketToServiceRecord...");
                    socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                    socket.connect();
                } catch (Exception e3) {
                    lastError = e3;
                    Log.w(TAG, "Metode 3 (Secure SPP) gagal: " + e3.getMessage());
                    try { if (socket != null) socket.close(); } catch (Exception ignored) {}
                    socket = null;
                }
            }

            // METODE 4: Secure RFCOMM Channel 1 via Reflection
            if (socket == null || !socket.isConnected()) {
                try {
                    Log.d(TAG, "Mencoba Metode 4: createRfcommSocket Channel 1...");
                    Method m = device.getClass().getMethod("createRfcommSocket", new Class[] { int.class });
                    socket = (BluetoothSocket) m.invoke(device, 1);
                    if (socket != null) {
                        socket.connect();
                    }
                } catch (Exception e4) {
                    lastError = e4;
                    Log.w(TAG, "Metode 4 (Secure Channel 1) gagal: " + e4.getMessage());
                    try { if (socket != null) socket.close(); } catch (Exception ignored) {}
                    socket = null;
                }
            }

            if (socket == null || !socket.isConnected()) {
                String errorMsg = lastError != null ? lastError.getMessage() : "Koneksi ditolak.";
                if (errorMsg.contains("-1") || errorMsg.contains("closed") || errorMsg.contains("timeout")) {
                    call.reject("Printer RPP02N sedang terkunci oleh aplikasi lain (seperti RawBT) atau printer perlu di-restart. Matikan saklar power printer lalu hidupkan lagi, kemudian klik Sambungkan.");
                } else {
                    call.reject("Gagal tersambung ke printer: " + errorMsg);
                }
                return;
            }

            connectedSocket = socket;
            outputStream = socket.getOutputStream();
            connectedAddress = address;
            connectedName = device.getName() != null ? device.getName() : "RPP02N";

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("name", connectedName);
            ret.put("address", connectedAddress);
            call.resolve(ret);
        } catch (SecurityException se) {
            call.reject("Izin Bluetooth diperlukan: " + se.getMessage());
        } catch (Exception e) {
            call.reject("Koneksi printer gagal: " + e.getMessage());
        }
    }

    @PluginMethod
    public void printBytes(PluginCall call) {
        String base64 = call.getString("base64");
        if (base64 == null || base64.isEmpty()) {
            call.reject("Data cetak struk tidak boleh kosong.");
            return;
        }

        // Cek koneksi aktif
        if (connectedSocket == null || !connectedSocket.isConnected() || outputStream == null) {
            // Percobaan auto-reconnect jika pernah tersambung
            if (connectedAddress != null) {
                try {
                    BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                    BluetoothDevice device = adapter.getRemoteDevice(connectedAddress);
                    if (adapter.isDiscovering()) {
                        adapter.cancelDiscovery();
                    }
                    BluetoothSocket socket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                    socket.connect();
                    connectedSocket = socket;
                    outputStream = socket.getOutputStream();
                } catch (Exception reErr) {
                    call.reject("Printer terputus. Nyalakan printer dan klik Sambungkan.");
                    return;
                }
            } else {
                call.reject("Printer belum tersambung.");
                return;
            }
        }

        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            outputStream.write(bytes);
            outputStream.flush();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal mengirim data cetak ke printer: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        boolean connected = connectedSocket != null && connectedSocket.isConnected();
        JSObject ret = new JSObject();
        ret.put("connected", connected);
        ret.put("name", connectedName);
        ret.put("address", connectedAddress);
        call.resolve(ret);
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        disconnectInternal();
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

    private void disconnectInternal() {
        try {
            if (outputStream != null) {
                outputStream.close();
            }
        } catch (Exception ignored) {}
        try {
            if (connectedSocket != null) {
                connectedSocket.close();
            }
        } catch (Exception ignored) {}
        outputStream = null;
        connectedSocket = null;
    }
}
