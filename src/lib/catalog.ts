export type Lang = "en" | "ar";

export const T: Record<Lang, Record<string, string>> = {
en:{home:'Home',movies:'Movies',tv:'TV Shows',genres:'Genres',countries:'Countries',myList:'My List',latest:'Latest',
popular:'Popular',topRated:'Top Rated',search:'Search',searchPh:'Search movies, TV shows...',play:'Play',watchNow:'Watch Now',
details:'Details',trailer:'Trailer',continueWatching:'Continue Watching',clear:'Clear',top10:'Top 10 Today',
trendingWeek:'Trending This Week',popularMovies:'Popular Movies',popularTv:'Popular TV Shows',nowPlaying:'Now Playing',
trendingTv:'Trending TV Today',turkish:'Turkish Series',korean:'Korean Drama',topMovies:'Top Rated Movies',
topTv:'Top Rated TV Shows',comingSoon:'Coming Soon',viewAll:'View All',genre:'Genre',country:'Country',year:'Year',
rating:'Rating',sortBy:'Sort',all:'All',anyYear:'Any Year',anyRating:'Any Rating',newest:'Newest',az:'A-Z',reset:'Reset',
cast:'Cast',director:'Director',seasons:'Seasons',season:'Season',episodes:'Episodes',episode:'Episode',status:'Status',
releaseDate:'Release Date',firstAir:'First Air Date',lastAir:'Last Air Date',network:'Network',language:'Language',
recommendations:'Recommendations',similar:'More Like This',addList:'Add to My List',inList:'✓ In My List',
servers:'Servers',nowWatching:'Now Watching',prevEp:'Previous Episode',nextEp:'Next Episode',airDate:'Air Date',
originalTitle:'Original Title',results:'Results for',noResults:'No results found',noResultsHint:'Try a different title or language.',
emptyList:'Your list is empty',emptyListHint:'Add movies and shows to find them here.',typeSearch:'Start typing to search Cimaly',
embedNotice:'Playback is provided by an external embedded player. If a server does not load, switch to another one.',
tmdbErr:'Content is temporarily unavailable. TMDB could not be reached.',min:'min',overview:'Overview',
recentlyWatched:'Recently Watched',tagline:'Global movies & TV shows, in English and Arabic.',
about:'Cimaly is a global streaming guide for movies and TV shows from the USA, UK, Europe, Türkiye, Korea, Japan, India, the Middle East, Latin America and beyond — fully bilingual in English and Arabic.',
browse:'Browse',langs:'Languages',rights:'All rights reserved.',
disclaimer:'This product uses the TMDB API but is not endorsed or certified by TMDB.'},
ar:{home:'الرئيسية',movies:'أفلام',tv:'مسلسلات',genres:'التصنيفات',countries:'الدول',myList:'قائمتي',latest:'الأحدث',
popular:'الأكثر شهرة',topRated:'الأعلى تقييماً',search:'بحث',searchPh:'ابحث عن أفلام ومسلسلات...',play:'تشغيل',
watchNow:'شاهد الآن',details:'التفاصيل',trailer:'الإعلان',continueWatching:'متابعة المشاهدة',clear:'مسح',
top10:'أفضل ١٠ اليوم',trendingWeek:'الرائج هذا الأسبوع',popularMovies:'أفلام شائعة',popularTv:'مسلسلات شائعة',
nowPlaying:'يعرض الآن',trendingTv:'مسلسلات رائجة اليوم',turkish:'مسلسلات تركية',korean:'دراما كورية',
topMovies:'أفلام الأعلى تقييماً',topTv:'مسلسلات الأعلى تقييماً',comingSoon:'قريباً',viewAll:'عرض الكل',genre:'التصنيف',
country:'الدولة',year:'السنة',rating:'التقييم',sortBy:'ترتيب',all:'الكل',anyYear:'أي سنة',anyRating:'أي تقييم',
newest:'الأحدث',az:'أ-ي',reset:'إعادة تعيين',cast:'طاقم التمثيل',director:'المخرج',seasons:'المواسم',season:'الموسم',
episodes:'الحلقات',episode:'الحلقة',status:'الحالة',releaseDate:'تاريخ الإصدار',firstAir:'تاريخ أول عرض',
lastAir:'تاريخ آخر عرض',network:'الشبكة',language:'اللغة',recommendations:'مقترحات',similar:'مشابه لهذا',
addList:'أضف إلى قائمتي',inList:'✓ في قائمتي',servers:'السيرفرات',nowWatching:'تشاهد الآن',prevEp:'الحلقة السابقة',
nextEp:'الحلقة التالية',airDate:'تاريخ البث',originalTitle:'العنوان الأصلي',results:'نتائج البحث عن',
noResults:'لا توجد نتائج',noResultsHint:'جرّب عنواناً آخر أو لغة مختلفة.',emptyList:'قائمتك فارغة',
emptyListHint:'أضف أفلاماً ومسلسلات لتجدها هنا.',typeSearch:'ابدأ الكتابة للبحث في سيمالي',
embedNotice:'يتم التشغيل عبر مشغّل خارجي مضمّن. إذا لم يعمل السيرفر جرّب سيرفراً آخر.',
tmdbErr:'المحتوى غير متاح مؤقتاً. تعذر الوصول إلى TMDB.',min:'د',overview:'القصة',recentlyWatched:'شوهدت مؤخراً',
tagline:'أفلام ومسلسلات من حول العالم، بالعربية والإنجليزية.',
about:'سيمالي دليل عالمي للأفلام والمسلسلات من أمريكا وبريطانيا وأوروبا وتركيا وكوريا واليابان والهند والشرق الأوسط وأمريكا اللاتينية وغيرها — بواجهة ثنائية اللغة.',
browse:'تصفّح',langs:'اللغات',rights:'جميع الحقوق محفوظة.',
disclaimer:'يستخدم هذا الموقع واجهة TMDB البرمجية وهو غير معتمد أو موثّق من TMDB.'}
};

export type Genre = { id: number; tv: number; slug: string; en: string; ar: string };
export const GENRES: Genre[] = [
 {id:28,tv:10759,slug:'action',en:'Action',ar:'أكشن'},{id:12,tv:10759,slug:'adventure',en:'Adventure',ar:'مغامرة'},
 {id:16,tv:16,slug:'animation',en:'Animation',ar:'أنيميشن'},{id:35,tv:35,slug:'comedy',en:'Comedy',ar:'كوميديا'},
 {id:80,tv:80,slug:'crime',en:'Crime',ar:'جريمة'},{id:99,tv:99,slug:'documentary',en:'Documentary',ar:'وثائقي'},
 {id:18,tv:18,slug:'drama',en:'Drama',ar:'دراما'},{id:10751,tv:10751,slug:'family',en:'Family',ar:'عائلي'},
 {id:14,tv:10765,slug:'fantasy',en:'Fantasy',ar:'فانتازيا'},{id:36,tv:10768,slug:'history',en:'History',ar:'تاريخي'},
 {id:27,tv:9648,slug:'horror',en:'Horror',ar:'رعب'},{id:9648,tv:9648,slug:'mystery',en:'Mystery',ar:'غموض'},
 {id:10749,tv:18,slug:'romance',en:'Romance',ar:'رومانسي'},{id:878,tv:10765,slug:'science-fiction',en:'Sci-Fi',ar:'خيال علمي'},
 {id:53,tv:9648,slug:'thriller',en:'Thriller',ar:'إثارة'},{id:10752,tv:10768,slug:'war',en:'War',ar:'حرب'}
];

export type Country = { c: string; en: string; ar: string };
export const COUNTRIES: Country[] = [
 {c:'us',en:'United States',ar:'الولايات المتحدة'},{c:'gb',en:'United Kingdom',ar:'المملكة المتحدة'},
 {c:'fr',en:'France',ar:'فرنسا'},{c:'de',en:'Germany',ar:'ألمانيا'},{c:'tr',en:'Türkiye',ar:'تركيا'},
 {c:'es',en:'Spain',ar:'إسبانيا'},{c:'it',en:'Italy',ar:'إيطاليا'},{c:'ca',en:'Canada',ar:'كندا'},
 {c:'au',en:'Australia',ar:'أستراليا'},{c:'kr',en:'South Korea',ar:'كوريا الجنوبية'},{c:'jp',en:'Japan',ar:'اليابان'},
 {c:'in',en:'India',ar:'الهند'},{c:'eg',en:'Egypt',ar:'مصر'},{c:'sa',en:'Saudi Arabia',ar:'السعودية'},
 {c:'ae',en:'UAE',ar:'الإمارات'},{c:'mx',en:'Mexico',ar:'المكسيك'},{c:'br',en:'Brazil',ar:'البرازيل'},
 {c:'cn',en:'China',ar:'الصين'}
];
