package id.incha.pos;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

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
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("Perangkat ini tidak memiliki Bluetooth.");
                return;
            }

            if (!adapter.isEnabled()) {
                call.reject("Bluetooth tidak aktif. Silakan nyalakan Bluetooth terlebih dahulu.");
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
            call.reject("Izin Bluetooth ditolak: " + se.getMessage());
        } catch (Exception e) {
            call.reject("Gagal mendapatkan daftar printer: " + e.getMessage());
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String address = call.getString("address");
        if (address == null || address.trim().isEmpty()) {
            call.reject("Alamat printer tidak boleh kosong.");
            return;
        }

        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                call.reject("Bluetooth tidak aktif.");
                return;
            }

            // Putuskan koneksi lama jika ada
            disconnectInternal();

            BluetoothDevice device = adapter.getRemoteDevice(address);
            adapter.cancelDiscovery();

            BluetoothSocket socket = null;
            try {
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                socket.connect();
            } catch (Exception ex1) {
                Log.w(TAG, "Standard SPP connection failed, fallback to reflection socket...", ex1);
                try {
                    Method m = device.getClass().getMethod("createRfcommSocket", new Class[] { int.class });
                    socket = (BluetoothSocket) m.invoke(device, 1);
                    if (socket != null) {
                        socket.connect();
                    }
                } catch (Exception ex2) {
                    call.reject("Gagal tersambung ke printer: " + ex2.getMessage());
                    return;
                }
            }

            if (socket == null || !socket.isConnected()) {
                call.reject("Tidak dapat membuka jalur koneksi ke printer.");
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
                    adapter.cancelDiscovery();
                    BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                    socket.connect();
                    connectedSocket = socket;
                    outputStream = socket.getOutputStream();
                } catch (Exception reErr) {
                    call.reject("Printer terputus. Buka pengaturan untuk menyambungkan printer.");
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
