package com.abdickers.shire;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;

/** Opens the actual live site immediately. Authentication remains in the real browser. */
public final class MainActivity extends Activity {
    @Override public void onCreate(Bundle state){super.onCreate(state);openDashboard();}
    private void openDashboard(){
        Uri destination=Uri.parse(PersonalSite.URL);
        try{
            CustomTabsIntent tab=new CustomTabsIntent.Builder()
                .setDefaultColorSchemeParams(new CustomTabColorSchemeParams.Builder().setToolbarColor(0xff172940).setNavigationBarColor(0xff172940).build())
                .setShowTitle(true).setUrlBarHidingEnabled(true).setShareState(CustomTabsIntent.SHARE_STATE_OFF).build();
            tab.launchUrl(this,destination);
            finish();
        }catch(ActivityNotFoundException unavailable){
            showBrowserRequired();
        }
    }
    private void showBrowserRequired(){
        LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);int pad=(int)(24*getResources().getDisplayMetrics().density);panel.setPadding(pad,pad,pad,pad);panel.setBackgroundColor(0xff172940);
        TextView message=new TextView(this);message.setText("Enable a browser to open The Shire. Your live dashboard and sign-in run in that browser’s secure app window.");message.setTextColor(Color.WHITE);message.setTextSize(18);panel.addView(message);
        Button retry=new Button(this);retry.setText("Try again");retry.setOnClickListener(v->openDashboard());panel.addView(retry);setContentView(panel);
    }
}
