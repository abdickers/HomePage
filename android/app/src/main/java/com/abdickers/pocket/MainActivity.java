package com.abdickers.pocket;

import android.app.Activity;
import android.app.AlertDialog;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.widget.*;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    static final int INK=0xff111e32,IVORY=0xfff4ecdc,SILVER=0xffbdcce0,GOLD=0xffe5cd92;
    private String realm; private LinearLayout column; private String notice="";
    @Override public void onCreate(Bundle state){super.onCreate(state);realm=Snapshots.selected(this);handle(getIntent());render();}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);handle(intent);render();}
    private void handle(Intent intent){
        if(intent.getData()!=null){notice=Snapshots.receive(this,intent.getData())?"Your widgets are up to date.":"Sync expired or could not be verified. Start a new sync.";realm=Snapshots.selected(this);intent.setData(null);}
        else if(intent.hasExtra("realm")){realm=Realms.normalize(intent.getStringExtra("realm"));Snapshots.select(this,realm);}
        if("SYNC".equals(intent.getAction())){intent.setAction(null);sync();}
    }
    int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private TextView text(String value,int size,int color){TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setIncludeFontPadding(true);return t;}
    private Button button(String title,Runnable action){Button b=new Button(this);b.setText(title);b.setAllCaps(false);b.setTextSize(13);b.setTextColor(IVORY);b.setBackgroundResource(R.drawable.button);b.setPadding(dp(10),dp(8),dp(10),dp(8));b.setMinHeight(dp(48));b.setMinimumHeight(dp(48));b.setMinWidth(0);b.setMinimumWidth(0);b.setOnClickListener(v->action.run());return b;}
    private void add(View view){column.addView(view);}
    private void row(String a,Runnable aa,String b,Runnable bb){LinearLayout row=new LinearLayout(this);row.setOrientation(LinearLayout.HORIZONTAL);LinearLayout.LayoutParams left=new LinearLayout.LayoutParams(0,-2,1);left.setMargins(0,dp(8),dp(4),dp(8));row.addView(button(a,aa),left);LinearLayout.LayoutParams right=new LinearLayout.LayoutParams(0,-2,1);right.setMargins(dp(4),dp(8),0,dp(8));row.addView(button(b,bb),right);add(row);}
    void render(){
        FrameLayout root=new FrameLayout(this);root.setBackgroundColor(INK);
        ImageView scene=new ImageView(this);scene.setImageResource(Realms.scene(realm));scene.setScaleType(ImageView.ScaleType.CENTER_CROP);scene.setAlpha(.42f);scene.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);root.addView(scene,new FrameLayout.LayoutParams(-1,-1));
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);root.addView(scroll,new FrameLayout.LayoutParams(-1,-1));column=new LinearLayout(this);column.setOrientation(LinearLayout.VERTICAL);column.setPadding(dp(18),dp(20),dp(18),dp(24));scroll.addView(column,new ScrollView.LayoutParams(-1,-2));
        root.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());scroll.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;});
        row("The Shire",()->choose("personal"),"Gondor Command",()->choose("work"));
        LinearLayout header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);ImageView emblem=new ImageView(this);emblem.setImageResource(Realms.emblem(realm));emblem.setContentDescription(null);header.addView(emblem,new LinearLayout.LayoutParams(dp(54),dp(60)));LinearLayout titles=new LinearLayout(this);titles.setOrientation(LinearLayout.VERTICAL);titles.setPadding(dp(12),0,0,0);TextView title=text(Realms.title(realm),30,IVORY);title.setTypeface(Typeface.SERIF);titles.addView(title);titles.addView(text("work".equals(realm)?"THE WHITE CITY · YOUR DAILY COUNCIL":"TWO TREES · YOUR PERSONAL REALM",10,GOLD));header.addView(titles,new LinearLayout.LayoutParams(0,-2,1));add(header);
        JSONObject data=Snapshots.read(this,realm);TextView updated=text(Snapshots.updated(data),12,SILVER);updated.setPadding(0,dp(12),0,dp(4));add(updated);
        row("Sync widget",this::sync,"Add widget",this::pin);
        if(!notice.isEmpty())card("Status",notice);
        JSONArray cards=data.optJSONArray("cards");
        if(cards==null||cards.length()==0){card("Welcome to your pocket realm","Tap Sync widget, sign in through your usual browser, then tap Save to phone. Your cached information will appear here and on your home-screen widget.");card("Private by design","Cloudflare and work sign-in stay enabled. No background polling. Widgets update only when you sync. Warcraft and Treasury are excluded.");}
        else for(int i=0;i<cards.length();i++){JSONObject c=cards.optJSONObject(i);if(c!=null)card(c.optString("title"),c.optString("body"));}
        TextView tools=text("QUICK ACCESS",11,GOLD);tools.setPadding(0,dp(18),0,dp(4));add(tools);
        if("work".equals(realm)){
            row("Work dashboard",()->open(Realms.WORK_URL),"Catalyst",()->open("https://s76hcatalyst.vercel.app/"));
            row("Gmail",()->open("https://mail.google.com/mail/?authuser=dickersona%4076fireworks.com"),"Calendar",()->open("https://calendar.google.com/calendar/r?authuser=dickersona%4076fireworks.com"));
        }else{
            row("Personal dashboard",()->open(Realms.PERSONAL_URL),"Google Home",()->open("https://home.google.com/?authuser=abdickers%40gmail.com"));
            row("Gmail",()->open("https://mail.google.com/mail/?authuser=abdickers%40gmail.com"),"Play Console",()->open("https://play.google.com/console/u/0/developers/7414653158827125834/home"));
        }
        row("Widget help",()->new AlertDialog.Builder(this).setTitle("Your home-screen widgets").setMessage("Long-press a free area of the Pixel home screen → Widgets → Pocket Command. Add The Shire and Gondor Command separately, then drag their resize handles. Each can occupy its own home-screen page.\n\nTap Sync widget to update. Information stays cached until your next sync; the timestamp shows its age. Data is visible on the unlocked home screen. No banking details are included.").setPositiveButton("Got it",null).show(),"Clear saved data",()->new AlertDialog.Builder(this).setTitle("Clear phone snapshots?").setMessage("Removes both cached dashboard snapshots from this app and its widgets. Your websites and sign-ins are unaffected.").setPositiveButton("Clear",(d,w)->{Snapshots.clear(this);notice="Saved snapshots cleared.";render();}).setNegativeButton("Cancel",null).show());
        TextView foot=text("Manual sync · private on this device · no banking or Warcraft",11,SILVER);foot.setPadding(0,dp(8),0,0);add(foot);setContentView(root);
    }
    private void choose(String value){realm=Realms.normalize(value);Snapshots.select(this,realm);notice="";render();}
    private void card(String title,String body){LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.VERTICAL);card.setBackgroundResource(R.drawable.card);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,dp(8),0,dp(2));TextView heading=text(title,21,IVORY);heading.setTypeface(Typeface.SERIF);card.addView(heading);TextView content=text(body.trim().isEmpty()?"No information available in this snapshot.":body,14,SILVER);content.setPadding(0,dp(6),0,0);content.setLineSpacing(dp(3),1);card.addView(content);column.addView(card,lp);}
    private void sync(){open(Snapshots.begin(this,realm).toString());}
    private void open(String url){try{new CustomTabsIntent.Builder().setDefaultColorSchemeParams(new CustomTabColorSchemeParams.Builder().setToolbarColor(INK).build()).setShowTitle(true).build().launchUrl(this,Uri.parse(url));}catch(android.content.ActivityNotFoundException e){notice="Install or enable a browser to complete sign-in and sync.";render();}}
    private void pin(){AppWidgetManager m=AppWidgetManager.getInstance(this);ComponentName provider=new ComponentName(this,"work".equals(realm)?WorkWidget.class:PersonalWidget.class);if(m.isRequestPinAppWidgetSupported())m.requestPinAppWidget(provider,null,null);else new AlertDialog.Builder(this).setMessage("Long-press your home screen → Widgets → Pocket Command.").setPositiveButton("OK",null).show();}
}
