package com.abdickers.pocket;

import android.app.Activity;
import android.appwidget.*;
import android.content.*;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import java.io.*;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class PocketTest {
    private Context context(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}
    private Uri payload(String realm,String nonce)throws Exception{
        JSONArray cards=new JSONArray();String[] titles="work".equals(realm)?new String[]{"Catalyst · deployment watch","Today’s council","Active quests"}:new String[]{"Weather at Sage Cabin","Today’s calendar","The hearth"};
        String[] bodies="work".equals(realm)?new String[]{"EMULATOR TEST DATA · Ready · Production · checked just now","EMULATOR TEST DATA · 9:30 AM · Project check-in","EMULATOR TEST DATA · 3 items awaiting review"}:new String[]{"EMULATOR TEST DATA · 71°F · Clear · Humidity 58% · Wind 2 mph","EMULATOR TEST DATA · 10:30 AM · Planning session","EMULATOR TEST DATA · 73°F · Cool mode · Idle"};
        String[] keys="work".equals(realm)?new String[]{"projects","calendar","quests"}:new String[]{"weather","calendar","hearth"};
        for(int i=0;i<3;i++)cards.put(new JSONObject().put("key",keys[i]).put("title",titles[i]).put("body",bodies[i]));
        String data=new JSONObject().put("version",1).put("realm",realm).put("capturedAt",System.currentTimeMillis()).put("cards",cards).toString();
        return Uri.parse("com.abdickers.pocket://snapshot").buildUpon().appendQueryParameter("realm",realm).appendQueryParameter("nonce",nonce).appendQueryParameter("data",Base64.encodeToString(data.getBytes(StandardCharsets.UTF_8),Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING)).build();
    }
    private void seed(String realm)throws Exception{String nonce=Snapshots.begin(context(),realm).getQueryParameter("pocket-sync");assertTrue(Snapshots.receive(context(),payload(realm,nonce)));}
    @Before public void reset(){Snapshots.clear(context());}
    @Test public void rejectsForgedExpiredAndReplayedHandoffs()throws Exception{
        assertFalse(Snapshots.receive(context(),payload("personal","0".repeat(64))));
        String nonce=Snapshots.begin(context(),"personal").getQueryParameter("pocket-sync");Uri valid=payload("personal",nonce);
        assertTrue(Snapshots.receive(context(),valid));assertFalse(Snapshots.receive(context(),valid));
        nonce=Snapshots.begin(context(),"personal").getQueryParameter("pocket-sync");assertFalse(Snapshots.receive(context(),payload("work",nonce)));
        context().getSharedPreferences("pocket",0).edit().putLong("pending_time_personal",System.currentTimeMillis()-700000).commit();assertFalse(Snapshots.receive(context(),payload("personal",nonce)));
    }
    @Test public void nativePersonalAndWorkScreensFit()throws Exception{
        for(String realm:new String[]{"personal","work"}){
            seed(realm);try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(new Intent(context(),MainActivity.class).putExtra("realm",realm))){
                InstrumentationRegistry.getInstrumentation().waitForIdleSync();
                scenario.onActivity(a->{View root=a.findViewById(android.R.id.content);assertTrue(root.getWidth()>0);checkBounds(root,root.getWidth());});
                shot("app-"+realm);
            }
        }
    }
    @Test public void realWidgetHostResizesBothProviders()throws Exception{
        InstrumentationRegistry.getInstrumentation().getUiAutomation().adoptShellPermissionIdentity("android.permission.BIND_APPWIDGET");
        AppWidgetManager manager=AppWidgetManager.getInstance(context());AppWidgetHost host=new AppWidgetHost(context(),812);host.startListening();
        try{
            for(String realm:new String[]{"personal","work"}){
                seed(realm);ComponentName provider=new ComponentName(context(),"work".equals(realm)?WorkWidget.class:PersonalWidget.class);int id=host.allocateAppWidgetId();Bundle options=options(390,700);
                assertTrue("Widget binding permission",manager.bindAppWidgetIdIfAllowed(id,provider,options));AppWidgetProviderInfo info=manager.getAppWidgetInfo(id);assertNotNull(info);
                try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(new Intent(context(),MainActivity.class))){
                    final AppWidgetHostView[] view={null};
                    scenario.onActivity(a->{view[0]=host.createView(a,id,info);view[0].setAppWidget(id,info);android.widget.FrameLayout hostRoot=new android.widget.FrameLayout(a);hostRoot.setPadding(0,72,0,72);hostRoot.addView(view[0]);a.setContentView(hostRoot);});
                    for(int[] size:new int[][]{{390,700},{300,340},{220,220}}){
                        Bundle dimensions=options(size[0],size[1]);manager.updateAppWidgetOptions(id,dimensions);manager.updateAppWidget(id,RealmWidget.views(context(),realm,dimensions));
                        scenario.onActivity(a->{int width=Math.round(size[0]*a.getResources().getDisplayMetrics().density),height=Math.round(size[1]*a.getResources().getDisplayMetrics().density);view[0].setLayoutParams(new android.widget.FrameLayout.LayoutParams(width,height));});
                        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
                        scenario.onActivity(a->{assertNotNull(view[0].findViewById(R.id.sync));assertTrue(view[0].findViewById(R.id.sync).isShown());});
                        shot("widget-"+realm+"-"+size[0]+"x"+size[1]);
                    }
                }finally{host.deleteAppWidgetId(id);}
            }
        }finally{host.stopListening();host.deleteHost();InstrumentationRegistry.getInstrumentation().getUiAutomation().dropShellPermissionIdentity();}
    }
    static Bundle options(int width,int height){Bundle b=new Bundle();b.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,width);b.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH,width);b.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,height);b.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,height);return b;}
    private void checkBounds(View v,int screen){assertTrue("View extends beyond screen: "+v.getClass().getSimpleName(),v.getWidth()<=screen);if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++)checkBounds(((ViewGroup)v).getChildAt(i),screen);}
    private void shot(String name)throws IOException{AccessibilityNodeInfo window=null;for(int attempt=0;attempt<50;attempt++){window=InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();if(window!=null&&"com.abdickers.pocket".equals(String.valueOf(window.getPackageName())))break;android.os.SystemClock.sleep(100);}assertNotNull("App accessibility window did not become ready",window);assertEquals("Screenshot must show our app, not a system dialog", "com.abdickers.pocket",String.valueOf(window.getPackageName()));Bitmap b=null;boolean rendered=false;for(int attempt=0;attempt<40;attempt++){b=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();if(b!=null){int varied=0;for(int x=1;x<10;x++)for(int y=1;y<10;y++){int pixel=b.getPixel(b.getWidth()*x/10,b.getHeight()*y/10);if(android.graphics.Color.red(pixel)<220||android.graphics.Color.green(pixel)<220||android.graphics.Color.blue(pixel)<220)varied++;}if(varied>20){rendered=true;break;}b.recycle();b=null;}android.os.SystemClock.sleep(150);}assertTrue("Screenshot remained blank after waiting for rendering",rendered);assertNotNull(b);File dir=new File(context().getExternalFilesDir(null),"screenshots");assertTrue(dir.isDirectory()||dir.mkdirs());String prefix=InstrumentationRegistry.getArguments().getString("screenLabel","pixel");try(FileOutputStream out=new FileOutputStream(new File(dir,prefix+"-"+name+".png"))){assertTrue(b.compress(Bitmap.CompressFormat.PNG,100,out));}b.recycle();}
}
