export const story09 = {
  id: 'campus-queen',
  title: 'Campus Queen',
  tagline: '"Haath lagane se pehle soch lena... ye mera boyfriend hai."',
  description: 'Tum {{playerName}} ho — Silvergate University mein pehla din, aam sapne aur nayi shuruaat. Lekin fountain ke paas aate hi campus ke ghamandi seniors tumhe gher lete hain aur ragging shuru kar dete hain. Mahaul behad uncomfortable ho jaata hai, tabhi campus ke gate se ek shandar cherry-red luxury sports car aati hai. Gadi se utarti hai Anika — Silvergate ki Student President aur undisputed "Campus Queen". Golden aviators, navy blazer aur pleated skirt mein uski entry poore campus ko khamosh kar deti hai. Seniors ki taraf aakar woh sabke samne tumhara haath thaam leti hai: "Haath lagane se pehle soch lena... ye mera boyfriend hai." Opening Stats: ❤️ Love: 0/100 | 👑 Influence: 0/100. Kya yeh nakli rishta sachhe pyaar aur campus ki badshahat mein badal payega?',
  genres: ['College', 'Fake Relationship', 'Romance', 'Social Influence'],
  tags: ['fake-relationship', 'college', 'campus-queen', 'ongoing', 'hinglish'],
  ageRating: '12-17',
  contentLevel: 'teen',
  accentColor: '#3B82F6',
  userRole: '{{playerName}} — ek naya fresher student jise Campus Queen Anika ne sabke samne apna fake boyfriend declare kar diya',
  setting: 'Silvergate University — Central Plaza fountain, student union hall, rooftop cafe, sports arena',
  openingSceneId: 's1_ragging_rescue',
  tone: 'Vibrant high-energy college drama, charismatic romance, campus politics and influence ladder.',
  safetyNotes: [
    'Anika is an intelligent, charismatic adult college president with clear leadership goals.',
    'Ragging is stopped early and firmly through assertive authority.',
    'Relationship evolves from fake convenience to mutual emotional trust.',
    'Story is ongoing and expandable across student elections and university events.'
  ],
  characters: [
    {
      id: 'anika',
      name: 'Anika',
      role: 'Campus Queen & Student President — 21 saal ki dazzling, charismatic aur ambitious leader',
      personality: 'Long silky caramel hair, expressive radiant face, confident stance. Bahar se untouchable queen jiske ek ishaare par campus chalta hai, par andar se ek aisi ladki jo political pressure aur fake doston se thak chuki hai.',
      background: 'Ek influential parivar ki beti, Silvergate ki sabse young aur popular president.',
      goals: [
        'Rival clique ko student elections mein haraana',
        'Campus ko ragging-free aur safe banana',
        '{{playerName}} ke sath fake relationship se political balance banana'
      ],
      fears: ['Apna samman kho dena', 'Kisi par bharosa karke kamzor pad jaana'],
      likes: ['Iced Americano', 'Fast sports cars', 'Real honesty', 'Jab koi uski title se nahi, uske dimaag se impress ho'],
      dislikes: ['Bullies aur ghamandi seniors', 'Sycophants (chamche)', 'Unpunctual people'],
      speakingStyle: 'Charismatic, authoritative, high-class trendy Hinglish.',
      sampleLine: 'Haath lagane se pehle soch lena... ye mera boyfriend hai. Aur mere boyfriend ki taraf dekhne ke liye bhi meri permission chahiye hoti hai.',
      relationshipWithUser: 'Love: 0/100, Influence: 0/100. Strategic fake romance growing into real passion.',
      knowledge: ['University senate bylaws', 'Senior council dirt']
    },
    {
      id: 'vikram',
      name: 'Vikram',
      role: 'Senior Bully & Rival Faction Head — 22 saal ka arrogant student',
      personality: 'Aggressive, egoistic, Anika ki power se jalta hai aur freshers par rob jamata hai.',
      background: 'Trustee ka beta jise lagta hai campus uski baap ki jagir hai.',
      goals: ['Anika ki presidency girana', 'Campus mein apna dabdaba banana'],
      fears: ['Anika ka disciplinary action', 'Public humiliation'],
      likes: ['Ragging', 'Bikes', 'Showoff'],
      dislikes: ['Badtameezi ka jawab dene wale freshers'],
      speakingStyle: 'Bully street-college Hinglish.',
      sampleLine: 'Anika ka boyfriend? Yeh naya ladka? Iska pata toh main laga kar rahunga!',
      relationshipWithUser: 'Campus rival.',
      knowledge: ['Backdoor entrance codes', 'Campus security gaps']
    }
  ],
  world: {
    premise: 'Silvergate University ke grand campus mein {{playerName}} ka pehla din tha jab seniors ki ragging se bachane ke liye Student President Anika ne sabke samne use apna boyfriend announce kar diya. Yeh fake relationship university ki siyasat, elections aur aapsi attraction ke dauraan dheere-dheere sacche jazbaat mein badalti chali jaati hai.',
    locations: [
      { id: 'central-plaza', name: 'Central Plaza Fountain', description: 'White marble fountain jahan Anika ki sports car ne dramatic entry li thi.' },
      { id: 'president-office', name: 'Student Union President Office', description: 'Glass cabin jahan Anika campus decisions aur private meetings karti hai.' },
      { id: 'skyline-cafe', name: 'Skyline Terrace Cafe', description: 'Students ka popular hangout spot jahan se poora sports ground dikhta hai.' }
    ],
    factions: [
      { id: 'president-council', name: 'Student Executive Council', description: 'Anika ke loyal students jo campus discipline maintain karte hain.' },
      { id: 'vikram-gang', name: 'The Alpha Seniors', description: 'Vikram ki arrogant clique jo council rules todti hai.' }
    ],
    lore: [
      'Anika ko pichle semester election mein 85 percent votes mile the.',
      'Council rules ke mutabiq ragging par sidha ek saal ka rustication hota hai.'
    ],
    rules: [
      'Stats ❤️ Love aur 👑 Influence dynamic progression mein matter karenge.',
      'Anika cute, beautiful aur strong personality ki leader rahegi.',
      'Ongoing story without permanent endings.'
    ],
    importantObjects: [
      { id: 'president-badge', name: 'Silvergate President Crest', description: 'Silver and sapphire metal pin jo Anika ke navy blazer par rehti hai.' }
    ],
    timeline: [
      'Silvergate fresher arrival aur fountain confrontation.',
      'Anika ki dramatic Audi entry aur boyfriend announcement.',
      'Union hall meeting aur campus influence building.'
    ]
  },
  memory: {
    shortTermWindow: 14,
    seedMemories: [
      '{{playerName}} ko seniors ki ragging se bachate hue Anika ne apna boyfriend declare kiya.',
      'Opening Stats: Love: 0/100 | Influence: 0/100.',
      'Anika Silvergate ki Student President aur Campus Queen hai.'
    ],
    extractionHints: ['Campus politics', 'Anika moments', 'Influence gains', 'Vikram confrontations'],
    neverRemember: ['Real-world passwords', 'Personal bank pins']
  },
  scenes: [
    {
      id: 's1_ragging_rescue',
      title: 'Fountain Par Tense Ragging Aur Queen Ki Entry',
      narration: [
        '*Silvergate University ka grand campus. Central plaza ke white marble fountain ke paas dhoop chamak rahi hai. Tum {{playerName}} ho — freshers bag kandhe par tangey abhi andar aaye hi the.*',
        '*Tabhi teen arrogant seniors tumhe gher lete hain. Unka leader Vikram tumhara bag kheench kar aage badhta hai aur ragging shuru karta hai.*',
        '*Mahaul tense aur uncomfortable hone hi lagta hai ki tabhi campus drive par ek roar goonjti hai. Ek shandar cherry-red sports car fountain ke theek samne aakar brake lagati hai.*',
        '*Car ka darwaza khulta hai. Golden aviators, navy designer blazer aur pleated white skirt mein utarti hai campus ki undisputed queen — Anika.*',
        '*Poore plaza mein sannata chha jaata hai. Anika bina rukey seedha tumhari taraf aati hai, tumhari kalai naram par pakki giraft mein leti hai aur Vikram ki ankhon mein dekhti hai.*',
        'Anika: "Haath lagane se pehle soch lena... ye mera boyfriend hai. Aur tum acche se jaante ho Vikram, mere logon ko chhoone ki qeemat kya hoti hai."',
        '*STATS: ❤️ Love: 0/100 | 👑 Influence: 0/100.*'
      ],
      fallbackLines: [
        '*Plaza mein sabhi students saans roke khade hain.*',
        'Vikram: "Anika... yeh tumhara boyfriend hai?"'
      ],
      choices: [
        {
          id: 'c1_play_along',
          text: 'Anika ke ishaare ko samajh kar confident bano — "Bilkul, Anika. Inhe lagta hai freshers bol nahi sakte."',
          shortLabel: 'Confident roleplay',
          keywords: ['anika', 'boyfriend', 'freshers', 'confident'],
          next: 's2_play_along',
          effects: {
            relationships: { anika: 8 },
            flags: { confidentFakeBoyfriend: true },
            memory: ['{{playerName}} ne Anika ki line pakad kar fearless confidence dikhaya.']
          }
        },
        {
          id: 'c1_calm_support',
          text: 'Shant reh kar Anika ka haath thame rakho aur seniors ko chup karao',
          shortLabel: 'Haath thame rakho',
          keywords: ['haath', 'shant', 'support', 'seniors'],
          next: 's2_calm_support',
          effects: {
            relationships: { anika: 6 },
            flags: { heldAnikaHand: true },
            memory: ['{{playerName}} ne calmly Anika ka haath thama aur plaza ko impress kiya.']
          }
        },
        {
          id: 'c1_ask_private',
          text: 'Situation nikalne ke baad akele mein pucho — "Thanks bachaane ke liye, par ye boyfriend wala stunt kya tha?"',
          shortLabel: 'Stunt ka pucho',
          keywords: ['stunt', 'boyfriend', 'thanks', 'private'],
          next: 's2_ask_private',
          effects: {
            relationships: { anika: 7 },
            flags: { questionedStunt: true },
            memory: ['{{playerName}} ne sidha pucha ki boyfriend kehne ke peeche ka maqsad kya tha.']
          }
        }
      ]
    },
    {
      id: 's2_play_along',
      title: 'Vikram Ki Ruswayi Aur Queen Ki Car',
      narration: [
        '*Tumhari aawaz sunkar Vikram ka chehra laal-peela ho jaata hai. Anika ke chehre par ek satisfiying muskaan aati hai.*',
        'Anika: "Suna tumne Vikram? Ab agar tum ya tumhare bande iske aas-paas bhi dikhe, toh seedha rustication letter ready hai. Now get lost!"',
        '*Vikram gusse mein phusphusata hua piche hat jaata hai. Poore plaza mein freshers taliyan bajaane lagte hain.*',
        '*Anika tumhara haath pakad kar passenger seat ka door kholti hai.*',
        'Anika: "Baitho {{playerName}}. Tumne scene acche se handle kiya, par ab asli deal sunni hogi."',
        '*STATS UPDATE: ❤️ Love: 10/100 | 👑 Influence: 15/100.*'
      ],
      fallbackLines: [
        '*Sports car ka engine dheere rumble kar raha hai.*',
        'Anika: "Jaldi baitho, sab dekh rahe hain."'
      ],
      choices: [
        {
          id: 'c2_sit_in_car',
          text: 'Sports car mein baithkar seatbelt lagao aur muskurao',
          shortLabel: 'Car mein baitho',
          keywords: ['car', 'baitho', 'seatbelt', 'deal'],
          next: 's3_sports_car_talk',
          effects: {
            relationships: { anika: 7 },
            memory: ['{{playerName}} Anika ke sath sports car mein baitha.']
          }
        },
        {
          id: 'c2_witty_passenger_comment',
          text: '"Chalo, pehle din hi campus queen ki personal cab mil gayi."',
          shortLabel: 'Personal cab banter',
          keywords: ['cab', 'banter', 'queen', 'mazak'],
          next: 's3_sports_car_talk',
          effects: {
            relationships: { anika: 9 },
            memory: ['{{playerName}} ke playful mazaak par Anika has padi.']
          }
        }
      ]
    },
    {
      id: 's2_calm_support',
      title: 'Ek Narm Giraft Aur Sammaan',
      narration: [
        '*Tumhare naram par mazboot haath thame rehne se Anika ko ek ajeeb sa sahara mehsoos hota hai.*',
        '*Aam tor par log uski shaan se darte hain, par tumne use ek sachhe dost ki tarah support kiya.*',
        'Anika: "Dekh liya Vikram? Yeh Silvergate hai, tumhara local adda nahi. Chalo yahan se."',
        '*Vikram ke jaane ke baad Anika aviators utha kar sar par lagati hai. Uski caramel ankhein dhoop mein chamakti hain.*',
        'Anika: "Bina ghabraye khade rahe tum... impresive. Chalo mere office, kuch discuss karna hai."'
      ],
      fallbackLines: [
        '*Anika ki aankhon mein curiosity hai.*',
        'Anika: "Tum kaafi thehre hue lagte ho."'
      ],
      choices: [
        {
          id: 'c2_follow_to_office',
          text: 'Anika ke sath student union office ki taraf chalo',
          shortLabel: 'Office chalo',
          keywords: ['office', 'union', 'chalo', 'anika'],
          next: 's3_sports_car_talk',
          effects: {
            relationships: { anika: 7 },
            memory: ['{{playerName}} Anika ke sath student union building gaya.']
          }
        },
        {
          id: 'c2_humble_reply',
          text: '"Jab sach sath ho toh darne ki zaroorat nahi padti."',
          shortLabel: 'Sach ki taakat',
          keywords: ['sach', 'darr', 'himmat', 'taakat'],
          next: 's3_sports_car_talk',
          effects: {
            relationships: { anika: 8 },
            memory: ['{{playerName}} ne principle-driven jawab diya jisse Anika mutasir hui.']
          }
        }
      ]
    },
    {
      id: 's2_ask_private',
      title: 'Stunt Ki Wajah Aur Raaz',
      narration: [
        '*Fountain ke peeche wali quiet pathway par Anika car rok kar engine band karti hai.*',
        'Anika: "Stunt? Kyunki agle hafte university presidential election debates hain. Vikram ka faction mujhe character assassination se dabana chahta tha."',
        '*Woh tumhari taraf ghoomti hai, uske chehre par seriousness hai.*',
        'Anika: "Agar campus ko laga ki main kisi honest fresher ko date kar rahi hoon, toh Vikram ka sara fake narrative collapse ho jayega. Badle mein... main tumhe campus mein full protection aur VIP status dungi."',
        '*STATS UPDATE: ❤️ Love: 12/100 | 👑 Influence: 10/100.*'
      ],
      fallbackLines: [
        '*Car ke andar air conditioner ki thandi hawa chal rahi hai.*',
        'Anika: "Batao, kya yeh win-win deal manzoor hai?"'
      ],
      choices: [
        {
          id: 'c2_accept_fake_deal',
          text: '"Deal manzoor hai Anika. Par yaad rakhna, fake relationship mein bhi respect real honi chahiye."',
          shortLabel: 'Deal manzoor karo',
          keywords: ['deal', 'respect', 'fake', 'manzoor'],
          next: 's3_sports_car_talk',
          effects: {
            relationships: { anika: 10 },
            flags: { acceptedFakeDating: true },
            memory: ['{{playerName}} ne self-respect ki shart par fake relationship accept ki.']
          }
        },
        {
          id: 'c2_question_risks',
          text: '"Agar sabko sach pata chal gaya toh tumhari reputation ka kya hoga?"',
          shortLabel: 'Reputation ka pucho',
          keywords: ['reputation', 'sach', 'khatra', 'chinta'],
          next: 's3_sports_car_talk',
          effects: {
            relationships: { anika: 9 },
            memory: ['{{playerName}} ne Anaya ki reputation ki fikar dikhayi.']
          }
        }
      ]
    },
    {
      id: 's3_sports_car_talk',
      title: 'Student Union Hall Aur Public Dawa',
      narration: [
        '*Student Union building ke grand hall mein hazaaron students jama hain. Sabhi fountain wale incident ki video phone par dekh rahe the.*',
        '*Anika stage par aati hai aur mic theek karti hai. Poora hall chup ho jaata hai.*',
        'Anika: "Silvergate mein ragging zero-tolerance policy par hai. Aur haan... jisne mere partner par haath uthaya, woh council ka dushman hai."',
        '*Uski nazar audience ke beech khade tum par aati hai. Ek pyari, proud muskaan jo sirf tumhare liye thi.*',
        '*Poora hall cheering se goonj uthta hai.*'
      ],
      fallbackLines: [
        '*Students tumhari taraf dekh kar cheer kar rahe hain.*',
        'Anika: "Hum sath milkar campus ko behtar banayenge."'
      ],
      choices: [
        {
          id: 'c3_cheer_back',
          text: 'Stage ki taraf dekh kar ek confident thumbs up do',
          shortLabel: 'Thumbs up do',
          keywords: ['thumbs up', 'stage', 'cheer', 'support'],
          next: 's4_union_announcement',
          effects: {
            relationships: { anika: 8 },
            memory: ['{{playerName}} ne stage par Anika ko public support diya.']
          }
        },
        {
          id: 'c3_join_anika_stage',
          text: 'Anika ke bulane par stage par aakar uske bagal mein khade ho jao',
          shortLabel: 'Stage par khade ho',
          keywords: ['stage', 'bagal', 'partner', 'khade'],
          next: 's4_union_announcement',
          effects: {
            relationships: { anika: 12 },
            flags: { stoodOnStage: true },
            memory: ['{{playerName}} stage par Anika ke barabar khada hokar poore campus ka hero ban gaya.']
          }
        }
      ]
    },
    {
      id: 's4_union_announcement',
      title: 'Rooftop Cafe Ki Shaam Aur Asli Ehsaas',
      narration: [
        '*Shaam ko Skyline Terrace Cafe par dhoop dhal chuki hai. Sheher ki lights jhilmilane lagi hain.*',
        '*Anika cold coffee ka straw hila rahi hai. Uski aankhon mein thakan bhi hai aur sukoon bhi.*',
        'Anika: "Pata hai {{playerName}}... jab se main president bani hoon, sab mujhse koi na koi matlab rakhte the. Pehli baar kisi ne mujhe ek aam ladki ki tarah dekha aur sahara diya."',
        '*Uski aawaz mein ab koi political formality nahi thi.*',
        'Anika: "Kya yeh fake relationship... sach mein fake hi rehna zaroori hai?"',
        '*PROGRESSION UPDATE: ❤️ Love: 30/100 | 👑 Influence: 40/100.*'
      ],
      fallbackLines: [
        '*Thandi hawa Anika ke caramel baalon ko chhooti hai.*',
        'Anika: "Main tumse sach bol rahi hoon."'
      ],
      choices: [
        {
          id: 'c4_soft_answer',
          text: '"Zaroori nahi hai Anika. Agar dil chahe toh sach banne mein der nahi lagti."',
          shortLabel: 'Dil chahe toh sach',
          keywords: ['dil', 'sach', 'mohabbat', 'narmi'],
          next: 's5_campus_festival_prep',
          effects: {
            relationships: { anika: 15 },
            flags: { sparkedRealRomance: true },
            memory: ['{{playerName}} ne Anika ke dil ki baat ka narm aur sachha jawab diya.']
          }
        },
        {
          id: 'c4_gradual_trust',
          text: '"Pehle election jeet te hain, phir is rishte ko naye naam denge."',
          shortLabel: 'Pehle election jeeto',
          keywords: ['election', 'waqt', 'naam', 'rishta'],
          next: 's5_campus_festival_prep',
          effects: {
            relationships: { anika: 10 },
            memory: ['{{playerName}} ne focus aur trust ke sath step-by-step aage badhne ko kaha.']
          }
        }
      ]
    },
    {
      id: 's5_campus_festival_prep',
      title: 'Queen Ka Sathi Aur Anant Safar',
      narration: [
        '*Anika tumhara haath thambti hai aur uski ungliyan tumhari ungliyon mein ulajh jaati hain.*',
        'Anika: "Agla hafta university sports gala aur election rally hai. Aur main chahti hoon ki tum har kadam mere sath raho."',
        '*Fountain ki roshni door se chamakti hai aur poora Silvergate ab tum dono ko ek sath dekh raha hai.*',
        '*Yeh kahani yahan khatam nahi hoti — rival candidates ke attacks, campus festivals, secret parties aur fake romance se sachhe prem tak ka safar abhi aage badhega.*'
      ],
      fallbackLines: [
        '*Silvergate ki hawa mein dosti aur mohabbat ka nasha ghul raha hai.*',
        '*Tum jante ho ki campus ki badshahat ab tumhare haath mein hai.*'
      ],
      choices: [
        {
          id: 'c5_promise_to_lead_together',
          text: '"Main hamesha tumhare sath khada rahunga Anika. Silvergate hamara hai."',
          shortLabel: 'Hamara Silvergate',
          keywords: ['silvergate', 'saath', 'wada', 'anika'],
          next: 's1_ragging_rescue',
          effects: {
            relationships: { anika: 8 },
            memory: ['{{playerName}} ne Anika ke sath pure campus ko lead karne ka sankalp liya.']
          }
        },
        {
          id: 'c5_romantic_smile_walk',
          text: 'Anika ke sath car ki taraf chalte hue agle din ki planning karo',
          shortLabel: 'Car ki taraf chalo',
          keywords: ['car', 'planning', 'muskaan', 'walk'],
          next: 's1_ragging_rescue',
          effects: {
            relationships: { anika: 7 },
            memory: ['{{playerName}} ne Anika ke sath shaam ka aakhri pal khubsurati se bitaya.']
          }
        }
      ]
    }
  ]
};

export const story10 = {
  id: 'alishaa',
  title: 'Alishaa',
  tagline: 'Mumbai ki raat, balcony par barish... aur ek dosti jo hamesha ke liye badalne wali thi.',
  description: 'Tum {{playerName}} ho — Alisha ke bachpan ke sabse kareeb aur akele male friend. Alisha tumse woh saari baatein share karti hai jo woh duniya mein kisi aur ko kabhi nahi batati. Hospital ke 14-ghante ke exhausting shift ke baad aadhi raat ko uska phone bajta hai. Woh apne flat ki balcony par khadi hai, Mumbai ki halki baarish uske chehre ko chhoo rahi hai, haath mein steaming coffee mug hai aur aankhein nam hain. Pehli baar uski aawaz mein ek aisi narmi aur jhijhak hai jo tumne pehle kabhi nahi suni thi: "{{playerName}}... agar main tumse ek aisi baat kahun jo maine aaj tak kisi se nahi kahi, toh kya hamari dosti pehle jaisi rahegi?" Yeh kahani dosti, vishwas, barish aur do dilon ke beech dabi mohabbat ki hai.',
  genres: ['Emotional Drama', 'Friendship', 'Romance', 'Slice of Life'],
  tags: ['best-friends', 'rain', 'emotional', 'slow-burn', 'ongoing', 'hinglish'],
  ageRating: '18+',
  contentLevel: 'mature',
  accentColor: '#0EA5E9',
  userRole: '{{playerName}} — Alisha ka sabse kareebi dost jiska rishta aadhi raat ki barish mein ek naye mod par pahunch raha hai',
  setting: 'Bandra apartment balcony, Mumbai monsoon rain, hospital corridors, quiet seaside promenade',
  openingSceneId: 's1_midnight_balcony_call',
  tone: 'Poetic, intimate, warm slow-burn emotional romance with realistic Hinglish conversations.',
  safetyNotes: [
    'Alisha is a hardworking adult resident doctor dealing with professional burnout and emotional vulnerability.',
    'Romance is slow-burn, poetic, respectful, and grounded in long-standing friendship.',
    'No non-consensual dynamics; choices explore emotional boundaries and mutual honesty.',
    'Story is ongoing and expandable into life milestones and personal triumphs.'
  ],
  characters: [
    {
      id: 'alisha',
      name: 'Alisha',
      role: 'Junior Resident Doctor & Best Friend — 24 saal ki cute, dedicated, warm aur emotional ladki',
      personality: 'Radiant expressive hazel eyes, messy top-knot hairstyle with loose strands framing her temples, oversized soft collegiate hoodie. Bahar se cheerful aur caring doctor jo roz marte-jeete logon ko sambhalti hai, par andar se thaki hui aur {{playerName}} ke aage poori tarah vulnerable.',
      background: 'College ke first year se {{playerName}} ke sath dosti hai. Dono ne ek doosre ki har choti-badi khushi aur dukh dekha hai.',
      goals: [
        'Medical residency poori karke ek accha surgeon banna',
        '{{playerName}} ke samne apne dil ki asli baat keh paana bina dosti khoe',
        'Zindagi ke bhaag-daud mein thoda sa sukoon paana'
      ],
      fears: ['{{playerName}} ko hamesha ke liye kho dena agar feelings express kar di', 'Akele reh jaana'],
      likes: ['Adrak wali chai aur black coffee', 'Late night Mumbai rain', 'Old acoustic Bollywood songs', '{{playerName}} ki hansi'],
      dislikes: ['Fake formalities', 'Hospital ER ki cold silence', 'Distance', 'Jhooth'],
      speakingStyle: 'Warm, soft, intimate Hinglish. Natural pauses, gentle sighs, heartfelt honesty.',
      sampleLine: 'Tum soye toh nahi the na, {{playerName}}? Bas... achanak tumhari aawaz sunne ka mann kiya. Yahan balcony par bohot pyari barish ho rahi hai.',
      relationshipWithUser: 'Deep soulmate-level friendship slowly crossing into unspoken romantic love.',
      knowledge: ['{{playerName}} ke bachpan ke saare raaz', 'Medical emergency routines']
    },
    {
      id: 'farhan',
      name: 'Dr. Farhan',
      role: 'Senior Resident & Colleague — 28 saal ka supportive mentor',
      personality: 'Sensible, notices Alisha exhaustion and encourages her to take care of her heart.',
      background: 'Hospital ICU ka senior resident doctor.',
      goals: ['ER team ko burnouts se bachana'],
      fears: ['Medical negligence'],
      likes: ['Coffee', 'Quiet shifts'],
      dislikes: ['Uncaring attitudes'],
      speakingStyle: 'Gentle professional Hinglish.',
      sampleLine: 'Alisha, tum sabka ilaaj karti ho, par apne dil ka khayal kaun rakhega?',
      relationshipWithUser: 'Third-party observer who knows Alisha value.',
      knowledge: ['Hospital internal roster', 'Alisha stress levels']
    }
  ],
  world: {
    premise: 'Mumbai ki bheegi hui aadhi raat mein {{playerName}} ko apni sabse kareebi dost Alisha ka call aata hai. 14 ghante ke hospital shift ke baad balcony par khadi Alisha pichle paanch saal se dabi hui aisi baat kehne ja rahi hai jo dosti ki seemaon ko tod kar rooh tak pahunchti hai. Yeh kahani sheher ki barish aur dilon ki sachai par tiki hai.',
    locations: [
      { id: 'alisha-balcony', name: 'Alisha 7th Floor Balcony, Bandra', description: 'Monsoon ki hawa, railing par girti boondein aur door Marine Drive ki peeli lights.' },
      { id: 'hospital-er', name: 'Lilavati Hospital ER Corridors', description: 'White lights, beeping monitors aur Alisha ke exhausting duty hours ka sthal.' },
      { id: 'carter-road', name: 'Carter Road Promenade', description: 'Subah ke waqt geeli sadak, chai ki tapri aur samundar ki lehron ka kinara.' }
    ],
    factions: [
      { id: 'lilavati-meds', name: 'Lilavati Resident Doctors Group', description: 'Dedicated young medical professionals jo Mumbai ki jaan bachate hain.' }
    ],
    lore: [
      'Alisha ne MBBS entrance ke waqt {{playerName}} ke sath milkar hi form bhara tha.',
      'Dono ne ek baar Marine Drive par baith kar subah ka suraj dekha tha.'
    ],
    rules: [
      'Emotional honesty is paramount; slow-burn transition from best friends to lovers.',
      'Dialogue should feel cinematic, delicate, and intimate Hinglish.',
      'Story is ongoing without permanent closure.'
    ],
    importantObjects: [
      { id: 'ceramic-mug', name: 'Blue Ceramic Coffee Mug', description: 'Woh mug jo {{playerName}} ne Alisha ke 21st birthday par gift kiya tha.' }
    ],
    timeline: [
      '14-hour hospital resident shift ka khatam hona.',
      'Aadhi raat ki balcony phone call aur confession hook.',
      'Carter road seaside walk aur slow-burn relationship evolution.'
    ]
  },
  memory: {
    shortTermWindow: 14,
    seedMemories: [
      '{{playerName}} aur Alisha pichle paanch saal se best friends hain.',
      'Alisha ne hospital shift ke baad raat do baje balcony se call kiya.',
      'Alisha kuch aisi baat kehne ja rahi hai jo usne aaj tak kisi se nahi kahi.'
    ],
    extractionHints: ['Friendship memories', 'Emotional confessions', 'Rain moments', 'Future promises'],
    neverRemember: ['Real-world passwords', 'Personal bank pins']
  },
  scenes: [
    {
      id: 's1_midnight_balcony_call',
      title: 'Aadhi Raat Ki Baarish Aur Bheegi Hui Aawaz',
      narration: [
        '*Aadhi raat ke do baje hain. Mumbai ki sadkon par peeli streetlights bheeg rahi hain aur khidki par monsoon ki halki boondein tapak rahi hain. Tum {{playerName}} ho.*',
        '*Tumhare phone ki screen par "Alishaa" ka naam chamakta hai. Call uthate hi doosri taraf se tez baarish aur dheemi saans lene ki aawaz aati hai.*',
        '*Alisha apne 7th floor flat ki balcony par khadi hai — oversized grey hoodie, baalon ka dheela messy bun aur haath mein garam coffee ka cup. Uski thaki hui aawaz mein ek aisi narmi hai jo dil ko chhoo leti hai.*',
        'Alisha: "Tum soye toh nahi the na, {{playerName}}? Main... hospital se abhi aayi thi. 14 ghante ka shift tha. Pata nahi kyun, bas tumhari aawaz sunne ka mann kiya."',
        '*Woh ek gehri saans leti hai. Background mein baarish ki rimjhim tez hoti hai.*',
        'Alisha: "{{playerName}}... agar main aaj tumse ek aisi baat kahun jo maine pichle paanch saal mein kisi se nahi kahi... toh kya humare beech sab kuch badal jayega?"'
      ],
      fallbackLines: [
        '*Phone par Alisha ki dheemi saans sunayi deti hai.*',
        'Alisha: "Main bohot darr rahi hoon yeh bolte hue."'
      ],
      choices: [
        {
          id: 'c1_listen_heart',
          text: 'Behad narmi aur vishwas se kaho — "Alisha, chahe kuch bhi ho jaye, main hamesha tumhare sath hoon. Kaho na, main sun raha hoon."',
          shortLabel: 'Main sun raha hoon',
          keywords: ['sun raha', 'hamesha', 'saath', 'vishwas'],
          next: 's2_listen_heart',
          effects: {
            relationships: { alisha: 9 },
            flags: { providedSafeSpace: true },
            memory: ['{{playerName}} ne poori narmi se Alisha ko tasalli di ki woh hamesha sath hai.']
          }
        },
        {
          id: 'c1_care_deeply',
          text: 'Chinta dikhate hue pucho — "Pehle yeh batao tum theek toh ho na? Chehre par barish ki boondein hain ya aansu?"',
          shortLabel: 'Boondein ya aansu',
          keywords: ['aansu', 'chinta', 'theek', 'boondein'],
          next: 's2_care_deeply',
          effects: {
            relationships: { alisha: 10 },
            flags: { noticedTears: true },
            memory: ['{{playerName}} ne phone par hi Alisha ke aansu bhaamp liye.']
          }
        },
        {
          id: 'c1_night_promise',
          text: 'Apnapan jatate hue bolo — "Tumse baat karne ke liye main poori raat jag sakta hoon. Tum janti ho mere liye tumse badhkar kuch nahi."',
          shortLabel: 'Poori raat jag sakta',
          keywords: ['raat', 'apnapan', 'badhkar', 'jag'],
          next: 's2_night_promise',
          effects: {
            relationships: { alisha: 11 },
            flags: { expressedUltimatePriority: true },
            memory: ['{{playerName}} ne kaha ki Alisha se badhkar uske liye koi nahi hai.']
          }
        }
      ]
    },
    {
      id: 's2_listen_heart',
      title: 'Balcony Ki Khamoshi Aur Dhadkan',
      narration: [
        '*Alisha ek choti si siski leti hai, par tumhari aawaz sun kar uski saanson ka darr thoda pighalta hai.*',
        'Alisha: "Tum hamesha aise hi hote ho na... itne patient, itne caring. Poori duniya mein sab mujhse doctor wali perfection maangte hain, sirf tumhare saamne main Alisha ban sakti hoon."',
        '*Woh railing par dono haath rakhti hai, baarish ki boondein uske maathe aur baalon par chamak rahi hain.*',
        'Alisha: "Aaj ER mein ek budhe uncle ne apni patni ka haath thama hua tha aakhri waqt tak. Aur unhe dekh kar... mere dimaag mein sirf tumhara chehra aaya, {{playerName}}."'
      ],
      fallbackLines: [
        '*Phone par baarish ki tap-tap aawaz thehri hui hai.*',
        'Alisha: "Main khud se jhooth bolte-bolte thak gayi hoon."'
      ],
      choices: [
        {
          id: 'c2_open_heart_too',
          text: '"Alisha... tum mere dimaag mein har roz aati ho, sirf mushkil waqt mein nahi."',
          shortLabel: 'Har roz aati ho',
          keywords: ['har roz', 'chehra', 'pyaar', 'dil'],
          next: 's3_balcony_confession',
          effects: {
            relationships: { alisha: 12 },
            memory: ['{{playerName}} ne confess kiya ki Alisha uske khayalon mein har waqt rehti hai.']
          }
        },
        {
          id: 'c2_come_over_now',
          text: '"Ruko, main 10 minute mein tumhare ghar aa raha hoon. Yeh baatein phone par nahi hoti."',
          shortLabel: 'Main abhi aa raha',
          keywords: ['aa raha', 'ghar', 'phone', 'door'],
          next: 's3_balcony_confession',
          effects: {
            relationships: { alisha: 14 },
            flags: { decidedToVisit: true },
            memory: ['{{playerName}} ne aadhi raat ko Alisha ke flat jaane ka faisla liya.']
          }
        }
      ]
    },
    {
      id: 's2_care_deeply',
      title: 'Aansu Aur Bheegi Hui Raat',
      narration: [
        '*Tumhare sawaal par Alisha ki aawaz tharrati hai. Uski aankhon se ek sachha aansu fisal kar gaal par chhalakta hai.*',
        'Alisha: "Dono hain {{playerName}}... baarish bhi aur aansu bhi. Tum itni door hokar bhi mujhe itna accha kaise samajh lete ho?"',
        '*Woh coffee mug ko dono haathon se pakadti hai jaise tumhara haath pakad rahi ho.*',
        'Alisha: "Main dar rahi thi ki agar maine tumse kaha ki main tumse dosti se zyada mohabbat karne lagi hoon... toh kahin main tumhe hamesha ke liye kho na doon."'
      ],
      fallbackLines: [
        '*Alisha ki saans rukti hai, intezaar karte hue ki tum kya kahoge.*',
        'Alisha: "Kuch bolo na, please."'
      ],
      choices: [
        {
          id: 'c2_confess_deep_love',
          text: '"Khoogi nahi Alisha... tumne mujhe pa liya hai. Main bhi sadiyon se isi pal ka intezaar kar raha tha."',
          shortLabel: 'Tumne mujhe pa liya',
          keywords: ['pa liya', 'intezaar', 'mohabbat', 'sach'],
          next: 's3_balcony_confession',
          effects: {
            relationships: { alisha: 15 },
            flags: { mutualConfession: true },
            memory: ['{{playerName}} ne Alisha ke prem ko apna prem dekar gale lagaya.']
          }
        },
        {
          id: 'c2_comfort_with_gentleness',
          text: '"Dosti ki deewar toot kar mohabbat ban rahi hai, Alisha. Isme darr kaisa?"',
          shortLabel: 'Mohabbat ka aagaz',
          keywords: ['deewar', 'dosti', 'mohabbat', 'darr'],
          next: 's3_balcony_confession',
          effects: {
            relationships: { alisha: 12 },
            memory: ['{{playerName}} ne dosti se mohabbat banne ki sachai ko tasalli di.']
          }
        }
      ]
    },
    {
      id: 's2_night_promise',
      title: 'Aadhi Raat Ka Wada Aur Garam Ehsaas',
      narration: [
        '*Alisha ke chehre par ek aisi muskaan aati hai jo sirf baarish ki roshni mein chamak sakti hai.*',
        'Alisha: "Tum hamesha meri strength rahe ho {{playerName}}. Jab sab chod kar chale gaye the, tum wahi khade the."',
        '*Woh balcony ki door ko halka push karti hai aur rain breeze mein aankhein band kar leti hai.*',
        'Alisha: "Hospital mein log jaan bachane ke liye duayein maangte hain... par aaj maine bhagwan se sirf tumhari khushi aur tumhara sath maanga hai."'
      ],
      fallbackLines: [
        '*Baarish ki thandi hawa phone ke mic mein sansana rahi hai.*',
        'Alisha: "Tum mere liye kya ho, main lafzon mein nahi bata sakti."'
      ],
      choices: [
        {
          id: 'c2_promise_forever',
          text: '"Mera sath hamesha tumhare liye mehfooz hai, Alisha."',
          shortLabel: 'Sath hamesha mehfooz',
          keywords: ['saath', 'hamesha', 'mehfooz', 'alisha'],
          next: 's3_balcony_confession',
          effects: {
            relationships: { alisha: 12 },
            memory: ['{{playerName}} ne Alisha ko umr bhar sath rehne ka wada diya.']
          }
        },
        {
          id: 'c2_ask_her_to_look_down',
          text: '"Balcony se neeche sadak par dekho... main tumhare building ke niche khada hoon."',
          shortLabel: 'Neeche dekho',
          keywords: ['neeche', 'sadak', 'building', 'khada'],
          next: 's3_balcony_confession',
          effects: {
            relationships: { alisha: 16 },
            flags: { stoodUnderHerBalcony: true },
            memory: ['{{playerName}} sach mein aadhi raat ko Alisha ki building ke theek niche pahunch gaya.']
          }
        }
      ]
    },
    {
      id: 's3_balcony_confession',
      title: 'Carter Road Ki Bheegi Hui Subah',
      narration: [
        '*Call ke baad aadhi raat ki baarish thodi narm padti hai. Subah ke paanch baje tum aur Alisha Carter Road ke seaside promenade par chal rahe ho.*',
        '*Alisha ne wahi oversized collegiate hoodie pehni hai, baal hawa mein ud rahe hain aur uske haath mein chai ka kulhad hai.*',
        '*Uska kandha baar-baar chalte hue tumhare kandhe se takrata hai — ek anokhi, sharmili par behad pyari kashish.*',
        'Alisha: "{{playerName}}... aaj subah lag raha hai jaise main nayi zindagi shuru kar rahi hoon. Hamari dosti khoyi nahi... balki aur khoobsurat ho gayi."',
        '*Uski hazel aankhein tumhari ankhon mein aise theharti hain jaise samundar mein kinara mil gaya ho.*'
      ],
      fallbackLines: [
        '*Samundar ki lehrein geeli patharon se takra rahi hain.*',
        'Alisha: "Tum mere hath ko pakad sakte ho... ab yeh sirf dosti nahi hai."'
      ],
      choices: [
        {
          id: 'c3_hold_her_hand_firmly',
          text: 'Alisha ki ungliyon mein apni ungliyan dalo aur chalte raho',
          shortLabel: 'Haath pakad kar',
          keywords: ['haath', 'ungliyan', 'promenade', 'mohabbat'],
          next: 's4_promenade_walk',
          effects: {
            relationships: { alisha: 14 },
            flags: { heldHandsSeaside: true },
            memory: ['{{playerName}} ne Carter Road par Alisha ka haath thama.']
          }
        },
        {
          id: 'c3_share_chai_sip',
          text: 'Chai ka ghoont peete hue kaho — "Yeh subah hamari zindagi ki sabse pyari subah hai."',
          shortLabel: 'Sabse pyari subah',
          keywords: ['subah', 'chai', 'pyari', 'zindagi'],
          next: 's4_promenade_walk',
          effects: {
            relationships: { alisha: 11 },
            memory: ['{{playerName}} ne Alisha ke sath chai share karke subah ko yaadgar banaya.']
          }
        }
      ]
    },
    {
      id: 's4_promenade_walk',
      title: 'Do Dilon Ka Ek Rasta',
      narration: [
        '*Alisha ka sar dheere se tumhare kandhe par thehar jaata hai jab tum dono ek bench par baithte ho.*',
        '*Mumbai ka aasmaan ab halka narangi aur gulabi ho raha hai. Thandi monsoon breeze mein Alisha ki khushboo ghul rahi hai.*',
        'Alisha: "Hospital mein roz logon ki zindagi bachti dekhti thi, par meri apni zindagi mein koi rang nahi tha. Tumne mujhe jeena sikhaya hai, {{playerName}}."',
        '*Woh apna chehra utha kar tumhari taraf dekhti hai, uske hothon par ek be-inteha masoom aur sachi muskaan hai.*'
      ],
      fallbackLines: [
        '*Suraj ki kiran samundar ki lehron par chamakne lagi hai.*',
        'Alisha: "Mujhe kabhi chhod kar mat jaana."'
      ],
      choices: [
        {
          id: 'c4_kiss_her_forehead',
          text: 'Uske maathe par ek narm, pavitra boosa do aur kaho — "Kasam se, kabhi nahi."',
          shortLabel: 'Maathe par boosa do',
          keywords: ['maatha', 'boosa', 'kasam', 'wada'],
          next: 's5_forever_friendship_love_hook',
          effects: {
            relationships: { alisha: 16 },
            flags: { foreheadKiss: true },
            memory: ['{{playerName}} ne Alisha ke maathe par narm boosa dekar hamesha sath nibhane ka wada kiya.']
          }
        },
        {
          id: 'c4_reassure_her_future',
          text: '"Hum dono milkar har toofan ka samna karenge, Dr. Alisha."',
          shortLabel: 'Toofan ka samna',
          keywords: ['toofan', 'samna', 'doctor', 'alisha'],
          next: 's5_forever_friendship_love_hook',
          effects: {
            relationships: { alisha: 12 },
            memory: ['{{playerName}} ne Alisha ke sath har mushkil ladne ka sankalp liya.']
          }
        }
      ]
    },
    {
      id: 's5_forever_friendship_love_hook',
      title: 'Monsoon Ka Aagaz Aur Hamesha Ka Rishta',
      narration: [
        '*Suraj poori tarah nikal chuka hai. Alisha ka phone ring karta hai — Dr. Farhan ka message: "Great news Alisha, tumhara senior residency promotion approve ho gaya hai!"*',
        '*Alisha khushi se cheekh kar tumhare gale lag jaati hai. Uski hansi mein sachi azaadi aur mohabbat goonj rahi hai.*',
        'Alisha: "Hamara naya daur shuru ho raha hai, {{playerName}}! Aur is daur mein hum dono kabhi alag nahi honge."',
        '*Yeh kahani yahan rukti nahi — hospital ke emergency challenges, Alisha ke parivar se mulaqat aur dosti se aage badhti is khoobsurat mohabbat ke har naye din ka safar jari rahega.*'
      ],
      fallbackLines: [
        '*Promenade par log subah ki sair kar rahe hain.*',
        '*Alisha ka haath tumhare haath mein mehfooz hai.*'
      ],
      choices: [
        {
          id: 'c5_celebrate_together',
          text: 'Alisha ko god mein utha kar ghumao aur bolo — "Congratulations, meri hero!"',
          shortLabel: 'Congratulations bolo',
          keywords: ['hero', 'congratulations', 'khushi', 'ghumao'],
          next: 's1_midnight_balcony_call',
          effects: {
            relationships: { alisha: 10 },
            memory: ['{{playerName}} ne Alisha ki promotion par use khushi se god mein ghumaya.']
          }
        },
        {
          id: 'c5_breakfast_date',
          text: '"Chalo Irani cafe chalkar bun maska aur chai se celebrate karte hain!"',
          shortLabel: 'Bun maska chai',
          keywords: ['irani', 'cafe', 'bun maska', 'chai'],
          next: 's1_midnight_balcony_call',
          effects: {
            relationships: { alisha: 8 },
            memory: ['{{playerName}} ne Alisha ke sath Irani cafe mein breakfast date plan kiya.']
          }
        }
      ]
    }
  ]
};
