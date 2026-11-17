package com.abdickers.shire;

import android.content.Context;
import android.content.Intent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.*;
import java.util.regex.Pattern;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class LiveSiteTest {
    @Test public void opensRealPersonalSiteAndCloudflareSignIn()throws Exception{
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        context.startActivity(new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("url","https://example.invalid/ignored"));
        Pattern host=Pattern.compile(".*(sage-cabin-nest|cloudflareaccess\\.com).*");
        assertTrue("Real Personal or Cloudflare Access origin must open",device.wait(Until.hasObject(By.res("com.android.chrome","url_bar").text(host)),45000));
        assertTrue("Access login must render",device.wait(Until.hasObject(By.text(Pattern.compile("(?is).*(email|sign in|log in|send.*code|cloudflare).*"))),45000));
        device.waitForIdle(10000);
        File dir=new File(context.getExternalFilesDir(null),"proof");assertTrue(dir.isDirectory()||dir.mkdirs());String label=InstrumentationRegistry.getArguments().getString("screenLabel","pixel");
        device.dumpWindowHierarchy(new File(dir,label+"-access-login.xml"));assertTrue(device.takeScreenshot(new File(dir,label+"-access-login.png")));
        try(PrintWriter out=new PrintWriter(new File(dir,label+"-scope.txt"))){out.println("Real private Shire website opened through Chrome. Cloudflare Access remains enabled. No credentials entered, no CAPTCHA solved, no access bypass. Authenticated Nest/calendar/mail controls require a real-phone user sign-in.");}
    }
}
