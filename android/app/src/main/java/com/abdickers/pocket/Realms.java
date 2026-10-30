package com.abdickers.pocket;

public final class Realms {
    public static final String PERSONAL="personal", WORK="work";
    public static final String PERSONAL_URL="https://sage-cabin-nest.nest-service.workers.dev/HomePage/";
    public static final String WORK_URL="https://adams-middle-earth-command.spirit-of-76-1921.chatgpt.site/";
    private Realms() {}
    public static String normalize(String realm){return WORK.equals(realm)?WORK:PERSONAL;}
    public static String title(String realm){return WORK.equals(normalize(realm))?"Gondor Command":"The Shire";}
    public static String url(String realm){return WORK.equals(normalize(realm))?WORK_URL:PERSONAL_URL;}
    public static int scene(String realm){return WORK.equals(normalize(realm))?R.drawable.gondor_scene:R.drawable.shire_scene;}
    public static int emblem(String realm){return WORK.equals(normalize(realm))?R.drawable.gondor_shield:R.drawable.realm_orb;}
}
