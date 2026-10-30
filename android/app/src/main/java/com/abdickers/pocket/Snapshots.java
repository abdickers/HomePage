package com.abdickers.pocket;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

/** Local, manual snapshots. No tokens, account credentials, jobs, or background reads. */
public final class Snapshots {
    private static SharedPreferences prefs(Context c){return c.getSharedPreferences("pocket",0);}
    public static String selected(Context c){return Realms.normalize(prefs(c).getString("realm","personal"));}
    public static void select(Context c,String realm){prefs(c).edit().putString("realm",Realms.normalize(realm)).apply();}
    public static JSONObject read(Context c,String realm){try{return new JSONObject(prefs(c).getString("snapshot_"+Realms.normalize(realm),"{}"));}catch(Exception e){return new JSONObject();}}
    public static Uri begin(Context c,String realm){
        realm=Realms.normalize(realm); byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);
        StringBuilder nonce=new StringBuilder();for(byte b:bytes)nonce.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
        prefs(c).edit().putString("pending_"+realm,nonce.toString()).putLong("pending_time_"+realm,System.currentTimeMillis()).apply();
        return Uri.parse(Realms.url(realm)).buildUpon().appendQueryParameter("pocket-sync",nonce.toString()).build();
    }
    public static boolean receive(Context c,Uri uri){
        try{
            if(uri==null||!"com.abdickers.pocket".equals(uri.getScheme())||!"snapshot".equals(uri.getHost())||uri.getPort()!=-1||uri.getUserInfo()!=null)return false;
            String realm=uri.getQueryParameter("realm"),nonce=uri.getQueryParameter("nonce"),raw=uri.getQueryParameter("data");
            if(!Realms.PERSONAL.equals(realm)&&!Realms.WORK.equals(realm))return false;
            String expected=prefs(c).getString("pending_"+realm,"");long age=System.currentTimeMillis()-prefs(c).getLong("pending_time_"+realm,0);
            if(expected.length()!=64||nonce==null||!java.security.MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),nonce.getBytes(StandardCharsets.UTF_8))||age<0||age>600000||raw==null||raw.length()>18000)return false;
            JSONObject incoming=new JSONObject(new String(Base64.decode(raw,Base64.URL_SAFE|Base64.NO_WRAP),StandardCharsets.UTF_8));
            if(!realm.equals(incoming.optString("realm"))||incoming.optInt("version")!=1)return false;
            long timestamp=incoming.optLong("capturedAt");if(Math.abs(System.currentTimeMillis()-timestamp)>600000)return false;
            JSONArray cards=incoming.optJSONArray("cards");if(cards==null||cards.length()>6)return false;
            JSONObject clean=new JSONObject();JSONArray safeCards=new JSONArray();
            for(int i=0;i<cards.length();i++){
                JSONObject card=cards.getJSONObject(i);String key=card.optString("key");
                if(!java.util.Arrays.asList("weather","hearth","calendar","mail","projects","priorities","quests","apps").contains(key))continue;
                JSONObject safe=new JSONObject();safe.put("key",key);safe.put("title",text(card.optString("title"),70));safe.put("body",text(card.optString("body"),640));safeCards.put(safe);
            }
            clean.put("version",1);clean.put("realm",realm);clean.put("capturedAt",timestamp);clean.put("cards",safeCards);
            prefs(c).edit().putString("snapshot_"+realm,clean.toString()).remove("pending_"+realm).remove("pending_time_"+realm).putString("realm",realm).apply();
            RealmWidget.updateAll(c);return true;
        }catch(Exception e){return false;}
    }
    static String text(String value,int max){String clean=value.replaceAll("[\\p{Cntrl}&&[^\\n]]","");return clean.substring(0,Math.min(clean.length(),max));}
    public static void clear(Context c){prefs(c).edit().remove("snapshot_personal").remove("snapshot_work").remove("pending_personal").remove("pending_work").apply();RealmWidget.updateAll(c);}
    public static String updated(JSONObject data){long time=data.optLong("capturedAt");if(time<=0)return "Not synced yet";String value=android.text.format.DateFormat.format("MMM d, h:mm a",time).toString();return (System.currentTimeMillis()-time>3600000?"Saved · ":"Synced · ")+value;}
}
