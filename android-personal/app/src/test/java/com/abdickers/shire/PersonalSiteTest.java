package com.abdickers.shire;
import org.junit.Test;
import static org.junit.Assert.*;
public class PersonalSiteTest {
    @Test public void fixedPrivateWorkDestination(){assertEquals("https://sage-cabin-nest.nest-service.workers.dev/HomePage/?app=personal",PersonalSite.URL);assertFalse(PersonalSite.URL.contains("pocket-sync"));assertFalse(PersonalSite.URL.contains("token"));}
}
