package com.abdickers.pocket;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

public abstract class RealmWidget extends AppWidgetProvider {
    protected abstract String realm();
    @Override public void onUpdate(Context c,AppWidgetManager manager,int[] ids){for(int id:ids)manager.updateAppWidget(id,views(c,realm(),manager.getAppWidgetOptions(id)));}
    @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager manager,int id,Bundle options){manager.updateAppWidget(id,views(c,realm(),options));}
    static void updateAll(Context c){AppWidgetManager manager=AppWidgetManager.getInstance(c);for(Class<?> type:new Class<?>[]{PersonalWidget.class,WorkWidget.class}){String realm=type==WorkWidget.class?"work":"personal";for(int id:manager.getAppWidgetIds(new ComponentName(c,type)))manager.updateAppWidget(id,views(c,realm,manager.getAppWidgetOptions(id)));}}
    static RemoteViews views(Context c,String realm,Bundle options){
        RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.realm_widget);
        JSONObject data=Snapshots.read(c,realm);v.setImageViewResource(R.id.scene,Realms.scene(realm));v.setImageViewResource(R.id.emblem,Realms.emblem(realm));v.setTextViewText(R.id.title,Realms.title(realm));v.setTextViewText(R.id.updated,Snapshots.updated(data));
        int height=options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,400);
        if(height<300){v.setViewVisibility(R.id.cards,View.GONE);v.setViewVisibility(R.id.privacy,View.GONE);v.setViewVisibility(R.id.emblem,View.GONE);v.setTextViewTextSize(R.id.title,android.util.TypedValue.COMPLEX_UNIT_SP,18);v.setTextViewTextSize(R.id.updated,android.util.TypedValue.COMPLEX_UNIT_SP,10);}
        int[] titles={R.id.card_title_1,R.id.card_title_2,R.id.card_title_3}, bodies={R.id.card_body_1,R.id.card_body_2,R.id.card_body_3},containers={R.id.card_1,R.id.card_2,R.id.card_3};
        JSONArray cards=data.optJSONArray("cards");
        for(int i=0;i<3;i++){
            JSONObject card=cards==null?null:cards.optJSONObject(i);
            boolean visible=(i==0||card!=null)&&(i==0||height>=((i==1)?340:490));
            v.setViewVisibility(containers[i],visible?View.VISIBLE:View.GONE);
            v.setTextViewText(titles[i],card==null?"Your realm, at a glance":card.optString("title"));
            v.setTextViewText(bodies[i],card==null?"Tap Sync to sign in and save a snapshot. No background data pulls.":card.optString("body"));
        }
        v.setTextViewText(R.id.privacy,"Cached on this phone · tap Sync to update");
        for(int id:new int[]{R.id.open,R.id.title})v.setOnClickPendingIntent(id,pending(c,realm,false));
        v.setOnClickPendingIntent(R.id.sync,pending(c,realm,true));
        return v;
    }
    private static PendingIntent pending(Context c,String realm,boolean sync){Intent intent=new Intent(c,MainActivity.class).setAction(sync?"SYNC":"OPEN").putExtra("realm",realm).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);int code=("work".equals(realm)?100:0)+(sync?1:2);return PendingIntent.getActivity(c,code,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
}
