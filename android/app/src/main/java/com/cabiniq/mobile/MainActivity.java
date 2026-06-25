package com.cabiniq.mobile;

import com.getcapacitor.BridgeActivity;

import android.os.Bundle;
import com.adeunis.capacitor.serial.RadarPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(RadarPlugin.class);
    }
}
