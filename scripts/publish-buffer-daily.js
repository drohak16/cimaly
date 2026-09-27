const BUFFER_API_URL='https://api.buffer.com';
const IMAGE_BASE='https://raw.githubusercontent.com/drohak16/cimaly/main/public/social/cimaly-2026-09-27-hd';
const REQUIRED=['BUFFER_API_KEY','BUFFER_CHANNEL_ID_FACEBOOK','BUFFER_CHANNEL_ID_INSTAGRAM']; for(const k of REQUIRED)if(!process.env[k])throw new Error(`Missing required secret: ${k}`);
const cfg={bufferApiKey:process.env.BUFFER_API_KEY,facebookChannelId:process.env.BUFFER_CHANNEL_ID_FACEBOOK,instagramChannelId:process.env.BUFFER_CHANNEL_ID_INSTAGRAM};
const POSTS=[
{key:'film-bilingual-hd',images:[`${IMAGE_BASE}/film-en.jpg`,`${IMAGE_BASE}/film-ar.jpg`],text:`🎬 WHY DID I GET MARRIED AGAIN?

Relationships, choices and old tensions return in this new chapter.

🎬 WHY DID I GET MARRIED AGAIN?

تعود العلاقات والاختيارات والتوترات القديمة في فصل جديد.

▶️ Watch now / شاهد الآن على Cimaly
https://cimaly.cc

#Cimaly #WhyDidIGetMarriedAgain #Movie #Film #فيلم`},
{key:'series-bilingual-hd',images:[`${IMAGE_BASE}/series-en.jpg`,`${IMAGE_BASE}/series-ar.jpg`],text:`📺 REACHER

Reacher returns with hard-hitting action, investigation and danger.

📺 ريتشر

يعود ريتشر مع الأكشن والتحقيق والمخاطر.

▶️ Watch now / شاهد الآن على Cimaly
https://cimaly.cc

#Cimaly #Reacher #Series #Action #مسلسل #اكشن`},
{key:'anime-bilingual-hd',images:[`${IMAGE_BASE}/anime-en.jpg`,`${IMAGE_BASE}/anime-ar.jpg`],text:`✨ JUJUTSU KAISEN

Dark fantasy, cursed energy and intense battles keep Jujutsu Kaisen among the most-followed anime.

✨ جوجوتسو كايسن

فانتازيا مظلمة وطاقة ملعونة ومعارك قوية تجعل جوجوتسو كايسن من أكثر الأنميات متابعة.

▶️ Watch now / شاهد الآن على Cimaly
https://cimaly.cc

#Cimaly #JujutsuKaisen #Anime #انمي #AnimeFans`}
];
async function assertImage(url){let r=await fetch(url,{method:'HEAD',redirect:'follow'});if(!r.ok)r=await fetch(url,{redirect:'follow'});if(!r.ok)throw new Error(`Required GitHub image unavailable: ${url} (${r.status})`)}
function metadata(n){return n==='facebook'?'metadata: { facebook: { type: post } }':'metadata: { instagram: { type: post shouldShareToFeed: true } }'}
async function createPost(network,channelId,p){const assets=p.images.map(url=>`{ image: { url: ${JSON.stringify(url)} } }`).join(', ');const query=`mutation CreatePost { createPost(input: { text: ${JSON.stringify(p.text)} channelId: ${JSON.stringify(channelId)} schedulingType: automatic mode: shareNow assets: [${assets}] ${metadata(network)} }) { ... on PostActionSuccess { post { id text } } ... on MutationError { message } } }`;const r=await fetch(BUFFER_API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${cfg.bufferApiKey}`},body:JSON.stringify({query})});const body=await r.json();if(!r.ok||body.errors?.length||body.data?.createPost?.message)throw new Error(`Buffer ${network} ${p.key}: ${JSON.stringify(body)}`);console.log(`OK ${network} ${p.key}: ${body.data.createPost.post.id}`)}
async function main(){await Promise.all([...new Set(POSTS.flatMap(p=>p.images))].map(assertImage));for(const p of POSTS)await Promise.all([createPost('facebook',cfg.facebookChannelId,p),createPost('instagram',cfg.instagramChannelId,p)])}
main().catch(e=>{console.error(e.message);process.exit(1)});