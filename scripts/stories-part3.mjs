export const story06 = {
  id: 'meri-khoonkhar-boss',
  title: 'Meri Khoonkhar Boss',
  tagline: 'Sharma Enterprises ki sabse beraham CEO... aur uska naya bechara Personal Assistant.',
  description: 'Tum {{playerName}} ho — Sharma Enterprises mein nayi joining hui hai as Personal Assistant to the Managing Director: Shivangi Sharma. Shivangi ko corporate circle mein "The Ice Queen" kaha jaata hai. Puraana PA pehle hi din aasu bahate hue resign kar chuka hai. Sharp jawline, charcoal pantsuit, aur kaatne wali zubaan ke sath Shivangi tumhare saamne khadi hai. Shuruati system: ATTRACTION: 0/100 | TURNS: 0 | SHIVANGI\'S MOOD: Cold | CURRENT ARC: 1. Kya tum is khoonkhar boss ke nakhre aur pressure jhel paoge, ya phir is barfili deewar ke peeche chupe ek naram dil ko pighla doge?',
  genres: ['Workplace Drama', 'Boss Romance', 'Progression', 'Slice of Life'],
  tags: ['boss-romance', 'office', 'workplace', 'progression', 'ongoing', 'hinglish'],
  ageRating: '18+',
  contentLevel: 'mature',
  accentColor: '#DC2626',
  userRole: '{{playerName}} — Shivangi Sharma ka naya executive assistant jo uske gusse aur corporate jungle ko handle kar raha hai',
  setting: 'Sharma Enterprises HQ, corner MD cabin, boardrooms, luxury business flight, aur late night office',
  openingSceneId: 's1_cabin_first_encounter',
  tone: 'Witty, intense workplace tension, sharp corporate banter, slow-burn romantic progression.',
  safetyNotes: [
    'Shivangi is an authoritative adult executive whose sharp exterior protects personal vulnerabilities.',
    'Workplace banter is witty, sarcastic, and professional.',
    'No harassment or non-consensual dynamics; progression reflects earned respect and competence.',
    'Story is ongoing and expandable into global corporate acquisitions and intimate moments.'
  ],
  characters: [
    {
      id: 'shivangi',
      name: 'Shivangi Sharma',
      role: 'Managing Director, Sharma Enterprises — 27 saal ki ruthless, gorgeous aur cold business tycoon',
      personality: 'Charcoal tailored suit, crimson blouse, high heels, high ponytail. Sharp sarcastic tongue, zero tolerance for mediocrity. Bahar se pathar, par andar se ek aisi aurat jisne khud ko corporate shikaariyon se bachane ke liye pathar bana liya hai.',
      background: 'Bina kisi godfather ke company ko top tier par laya. Har competitor ne use dabana chaha, par usne sabko koot diya.',
      goals: [
        'London acquisition deal close karna',
        'Sharma Enterprises ko bulletproof banana',
        'Ek aisa PA paana jo uske gusse ke aage kaanpe nahi'
      ],
      fears: ['Kamzor dikhna', 'Kisi par depend ho jaana'],
      likes: ['Punctuality', 'Black coffee without sugar', 'Precision', 'Jo uski daant se dare nahi'],
      dislikes: ['Excuse aur bahane', 'Aansu', 'Over-flattery', 'Der se aana'],
      speakingStyle: 'Cold, sarcastic, biting Hinglish. One-liners that cut like glass.',
      sampleLine: 'Pichla PA teen ghante tika tha, {{playerName}}. Tumhara resume kehta hai tum survive karoge. Prove it, ya abhi bahar jao.',
      relationshipWithUser: 'ATTRACTION: 0/100, SHIVANGI\'S MOOD: Cold. Will evolve through competence.',
      knowledge: ['Competitor balance sheets', 'Board members dirty secrets']
    },
    {
      id: 'sameer',
      name: 'Sameer Verma',
      role: 'HR Head — 32 saal ka nervous executive',
      personality: 'Shivangi ka naam sunte hi paseena chhootne lagta hai, par dil ka bhala insaan hai.',
      background: 'Company ke saare recruitments handle karta hai.',
      goals: ['Shivangi ke cabin mein koi PA kam se kam ek hafte tikwa paana'],
      fears: ['Shivangi ka termination notice'],
      likes: ['Calm days', 'Green tea'],
      dislikes: ['Board meetings'],
      speakingStyle: 'Whispering, nervous corporate Hinglish.',
      sampleLine: 'Best of luck bhai {{playerName}}... Shivangi ma\'am ke saamne breathing bhi schedule se karna padta hai.',
      relationshipWithUser: 'Colleague jo pehle se alert karta rehta hai.',
      knowledge: ['Office internal hierarchy', 'Shivangi past fired assistants list']
    }
  ],
  world: {
    premise: 'Sharma Enterprises ke 30th floor par chalta hai ek ajeeb sa dabdaba. MD Shivangi Sharma ki zubaan tezaab jaisi hai aur uske cabin se har hafte naye assistants rote hue nikalte hain. {{playerName}} naya PA bankar aata hai, jahan ATTRACTION: 0/100 aur SHIVANGI\'S MOOD: Cold se shuruaat hoti hai. Uski competence aur fearless attitude dheere-dheere boss ke dil ke darwaze kholte hain.',
    locations: [
      { id: 'md-cabin', name: 'Corner MD Cabin, 30th Floor', description: 'Soundproof glass walls, minimalist Italian furniture, aur sheher ka magnificent view.' },
      { id: 'pa-desk', name: 'Executive PA Desk', description: 'Theek cabin ke bahar ka desk jahan teen computer screens aur coffee maker rakha hai.' },
      { id: 'boardroom', name: 'Grand Boardroom', description: 'Jahan Shivangi boorhe directors ko unki galtiyon par zaleel karti hai.' }
    ],
    factions: [
      { id: 'sharma-board', name: 'Sharma Enterprises Executive Board', description: 'Purane khandan ke business partners jo Shivangi ko girana chahte hain.' }
    ],
    lore: [
      'Shivangi ne pichle saal akeli ladkar company ko bankruptcy se bachaya tha.',
      'Uske gusse ke peeche 18-ghante ki roz ki exhausting akelepan ki thakan hai.'
    ],
    rules: [
      'Shivangi ka mood dynamic progression par chalega: Cold -> Irritated -> Curious -> Impressed -> Soft.',
      'Player ki bold competence aur boundaries use respect dilayengi.',
      'Kahani ongoing aur expandable rahegi.'
    ],
    importantObjects: [
      { id: 'black-coffee-mug', name: 'Matte Black Espresso Cup', description: 'Shivangi ka khas cup jismein bina cheeni aur bina doodh ki tez coffee aati hai.' }
    ],
    timeline: [
      'Pichle PA ka dramatic resignation.',
      '{{playerName}} ki entry aur pehla encounter.',
      'Late night crisis aur London merger arc.'
    ]
  },
  memory: {
    shortTermWindow: 14,
    seedMemories: [
      '{{playerName}} Shivangi Sharma ka naya PA bana hai.',
      'Initial System: ATTRACTION: 0/100 | TURNS: 0 | SHIVANGI\'S MOOD: Cold | CURRENT ARC: 1.',
      'Shivangi sarcastic aur demanding hai, pichla assistant teen ghante mein chala gaya tha.'
    ],
    extractionHints: ['Shivangi mood changes', 'Workplace triumphs', 'Attraction points', 'Late night secrets'],
    neverRemember: ['Real-world passwords', 'Personal bank pins']
  },
  scenes: [
    {
      id: 's1_cabin_first_encounter',
      title: 'Glass Cabin Ki Barfili Hawa',
      narration: [
        '*Sharma Enterprises ki 30th floor. Floor-to-ceiling glass cabin mein aisi khamoshi hai jaise toofan aane se pehle hoti hai. Tum {{playerName}} ho — naye PA.*',
        '*Pichla PA abhi-abhi apni file chhod kar rote hue lift ki taraf bhaaga hai. Cabin ke andar se phone par ek gusse bhari aawaz goonjti hai.*',
        'Shivangi: "Nahi, Mr. Singhania! Agar shaam tak contract terms change nahi hue toh deal cancel samjho. Mujhe excuse nahi result chahiye!"',
        '*Call kaat kar woh ghoomti hai. Sculpted cheekbones, high ponytail aur charcoal blazer mein behad stunning aur intimidating shaksiyat: Shivangi Sharma.*',
        '*Uski teekhi nazrein pehli baar tum par padti hain.*',
        'Shivangi: "Toh tum ho naye PA? Pichla wala teen ghante mein toot gaya. Batao {{playerName}}, tum yahan time waste karne aaye ho ya sach mein dimaag hai tumhare paas?"',
        '*STATUS PANEL: ATTRACTION: 0/100 | TURNS: 0 | SHIVANGI\'S MOOD: Cold | CURRENT ARC: 1.*'
      ],
      fallbackLines: [
        '*Shivangi phone ko desk par patakti hai aur tumhari file kholti hai.*',
        'Shivangi: "Main bina soche-samjhe bolne walon ko tolerate nahi karti."'
      ],
      choices: [
        {
          id: 'c1_competent_reply',
          text: 'Shant confidence ke sath file aage karo — "Main time waste nahi karta, ma\'am. Yeh raha London deal ka revised audit report."',
          shortLabel: 'Audit report do',
          keywords: ['audit', 'report', 'london', 'shant'],
          next: 's2_competent_reply',
          effects: {
            relationships: { shivangi: 8 },
            flags: { showedCompetence: true },
            memory: ['{{playerName}} ne aate hi London deal ki audit report pesh karke Shivangi ko chup karaya.']
          }
        },
        {
          id: 'c1_bold_banter',
          text: 'Uski aankhon mein dekh kar halki muskaan do — "Main itni aasani se tootne walon mein se nahi hoon, ma\'am."',
          shortLabel: 'Nahi tootne wala',
          keywords: ['muskaan', 'bold', 'tootne', 'himmat'],
          next: 's2_bold_banter',
          effects: {
            relationships: { shivangi: 6 },
            flags: { teasedShivangi: true },
            memory: ['{{playerName}} ne bina dare Shivangi ki ankhon mein dekh kar himmat dikhayi.']
          }
        },
        {
          id: 'c1_coffee_move',
          text: 'Dheere se pucho — "Aapki black coffee pehle laaun, ya pehle pending signatures karwayein?"',
          shortLabel: 'Black coffee pucho',
          keywords: ['coffee', 'signature', 'desk', 'black'],
          next: 's2_coffee_move',
          effects: {
            relationships: { shivangi: 7 },
            flags: { rememberedCoffee: true },
            memory: ['{{playerName}} ne bina bataye Shivangi ki black coffee ki aadat ka dhyan rakha.']
          }
        }
      ]
    },
    {
      id: 's2_competent_reply',
      title: 'Report Ki Jaanch Aur Naram Tewar',
      narration: [
        '*Shivangi file kheench kar kholti hai. Uski ungliyan tezi se financial numbers par chalti hain.*',
        '*Uski eyebrow dheere se uthti hai. Jo calculation uske purane senior analyst teen din mein nahi kar paaye the, woh tumne pehle page par highlight kar diya tha.*',
        'Shivangi: "Page four ka deficit... tumne Singapore currency fluctuation ke hisaab se adjust kiya hai?"',
        '*Tum: "Ji ma\'am. Teen percent ka buffer bacha kar."*',
        '*Shivangi file band karti hai. Uske labon par ek adrishya muskaan aakar turant chali jaati hai.*',
        'Shivangi: "Not bad, {{playerName}}. Kam se kam pichle gadhe se toh behtar ho. Ab jaao, 20 minute mein coffee aur Singapore team ki meeting set karo."',
        '*STATUS UPDATE: ATTRACTION: 12/100 | SHIVANGI\'S MOOD: Impressed | TURNS: 1.*'
      ],
      fallbackLines: [
        '*Shivangi pen ko laptop ke bagal mein rakhti hai.*',
        'Shivangi: "Der mat karna, mera waqt mehenga hai."'
      ],
      choices: [
        {
          id: 'c2_execute_order',
          text: '"On it, ma\'am. 15 minute mein sab ready hoga."',
          shortLabel: '15 minute ka wada',
          keywords: ['ready', 'order', 'fast', 'minute'],
          next: 's3_late_night_crisis',
          effects: {
            relationships: { shivangi: 6 },
            memory: ['{{playerName}} ne 15 minute mein saari meetings coordinate kar di.']
          }
        },
        {
          id: 'c2_smooth_smile',
          text: 'Ek respectful nod ke sath kaho — "Aapko disappoint nahi karunga."',
          shortLabel: 'Disappoint nahi',
          keywords: ['disappoint', 'respect', 'nod', 'kaam'],
          next: 's3_late_night_crisis',
          effects: {
            relationships: { shivangi: 7 },
            memory: ['{{playerName}} ne calm dedication se Shivangi ka bharosa jeeta.']
          }
        }
      ]
    },
    {
      id: 's2_bold_banter',
      title: 'Aankhon Ki Takkar Aur Challenge',
      narration: [
        '*Shivangi chair ki taraf do kadam aage aati hai. Uski stilettos ki thak-thak soundproof floor par bhi goonjti hai.*',
        '*Woh tumhare itne qareeb aakar rukti hai ki tum uske expensive French perfume ki lavender mehak mehsoos kar sakte ho.*',
        'Shivangi: "Bade bol bolna aasan hota hai, {{playerName}}. Yahan aakar har koi yahi kehta hai. Par jab main files phek kar maarti hoon, toh sabki aukaat saamne aa jaati hai."',
        '*Tumhari palkein bina jhuke uski kaali ankhon par tiki rehti hain.*',
        'Shivangi: "Dekhte hain tumhari yeh akad kab tak tikti hai. Desk par baitho aur mujhe London merger ki saari loopholes chahiye subah se pehle."',
        '*STATUS UPDATE: ATTRACTION: 15/100 | SHIVANGI\'S MOOD: Curious | TURNS: 1.*'
      ],
      fallbackLines: [
        '*Shivangi ke honthon ke kone par ek dabi hui चुनौती hai.*',
        'Shivangi: "Jao, kaam shuru karo."'
      ],
      choices: [
        {
          id: 'c2_take_desk',
          text: '"Loopholes shaam tak mil jayengi ma\'am. Uski chinta mat kijiye."',
          shortLabel: 'Shaam tak loopholes',
          keywords: ['loopholes', 'desk', 'shaam', 'kaam'],
          next: 's3_late_night_crisis',
          effects: {
            relationships: { shivangi: 7 },
            memory: ['{{playerName}} ne challenge accept karke deadlines beat ki.']
          }
        },
        {
          id: 'c2_witty_comeback',
          text: '"Files sambhal kar phekiyega ma\'am, paper cuts bohot dard dete hain."',
          shortLabel: 'Paper cuts banter',
          keywords: ['paper cut', 'files', 'mazak', 'banter'],
          next: 's3_late_night_crisis',
          effects: {
            relationships: { shivangi: 9 },
            flags: { crackedBossSmile: true },
            memory: ['{{playerName}} ke paper cuts wale mazaak par Shivangi ka gussa hawa ho gaya.']
          }
        }
      ]
    },
    {
      id: 's2_coffee_move',
      title: 'Espresso Aur Chhupa Hua Sammaan',
      narration: [
        '*Shivangi thehar jaati hai. Uski nazron mein hairani saaf jhalak rahi thi.*',
        'Shivangi: "Tumhe kisne bataya ki main black coffee peeti hoon? HR ne?"',
        '*Tum: "Nahi ma\'am. Maine desk par khali cup dekha aur schedule se andaza lagaya."*',
        '*Shivangi ek gehri saans leti hai. Uski kandhon ka rigid posture thoda dheela padta hai.*',
        'Shivangi: "Observation skills achhi hain tumhari. Double shot lana, bina sugar ke. Aur sath mein Singhania Group ki file."',
        '*STATUS UPDATE: ATTRACTION: 14/100 | SHIVANGI\'S MOOD: Softening | TURNS: 1.*'
      ],
      fallbackLines: [
        '*Coffee machine se steam nikalne lagti hai.*',
        'Shivangi: "Chalo kam se kam ek cheez dhang se aati hai tumhe."'
      ],
      choices: [
        {
          id: 'c2_serve_coffee',
          text: 'Garam double espresso tray par rakh kar cabin mein pesh karo',
          shortLabel: 'Espresso pesh karo',
          keywords: ['espresso', 'tray', 'cabin', 'coffee'],
          next: 's3_late_night_crisis',
          effects: {
            relationships: { shivangi: 8 },
            memory: ['{{playerName}} ne perfect temperature par espresso serve kiya.']
          }
        },
        {
          id: 'c2_brief_summary',
          text: 'Coffee dete hue sath mein Singhania file ka 2-minute summary verbal batao',
          shortLabel: 'Verbal summary do',
          keywords: ['summary', 'file', 'singhania', 'verbal'],
          next: 's3_late_night_crisis',
          effects: {
            relationships: { shivangi: 10 },
            memory: ['{{playerName}} ne verbal briefing dekar Shivangi ka 20 minute ka waqt bachaya.']
          }
        }
      ]
    },
    {
      id: 's3_late_night_crisis',
      title: 'Aadhi Raat Ka Toofan Aur Akeli Boss',
      narration: [
        '*Raat ke 11 baj chuke hain. Office ki baaki saari floors band hain, sirf 30th floor ki yellow lights jal rahi hain.*',
        '*Bahar Mumbai ki tez baarish glass windows par thak-thak baja rahi hai. Shivangi apne cabin mein sar pakad kar baithi hai.*',
        '*Uski high ponytail ab dheeli ho chuki hai, blazer chair par latka hai aur sirf crimson blouse mein woh thaki hui dikh rahi hai.*',
        'Shivangi: "Singhania ne backout kar diya, {{playerName}}... board kal subah mera resignation maang lega."',
        '*Uski aawaz mein pehli baar koi taunt ya akad nahi thi. Sirf ek thaki hui ladki ka sach tha.*'
      ],
      fallbackLines: [
        '*Baarish ki goonj cabin mein phaili hui hai.*',
        'Shivangi: "Main haar nahi sakti... bilkul nahi."'
      ],
      choices: [
        {
          id: 'c3_offer_alternate_buyer',
          text: 'Desk par aakar naya buyer presentation kholo — "Singhania gaya toh kya hua? Dubai logistics syndicate ready hai."',
          shortLabel: 'Dubai buyer batao',
          keywords: ['dubai', 'buyer', 'plan b', 'presentation'],
          next: 's4_rain_delay_penthouse',
          effects: {
            relationships: { shivangi: 15 },
            flags: { savedMerger: true },
            memory: ['{{playerName}} ne crisis ke waqt Dubai alternate buyer pitch karke deal bacha li.']
          }
        },
        {
          id: 'c3_bring_warm_water',
          text: 'Pehle garam paani aur dawa do — "Aapka sar dard ho raha hai ma\'am, pehle do minute saans lijiye."',
          shortLabel: 'Dawa aur tasalli do',
          keywords: ['paani', 'dawa', 'tasalli', 'saans'],
          next: 's4_rain_delay_penthouse',
          effects: {
            relationships: { shivangi: 12 },
            flags: { comfortedBossVulnerable: true },
            memory: ['{{playerName}} ne boss ki tabiyat ka dhyan rakha jab woh bilkul toot chuki thi.']
          }
        }
      ]
    },
    {
      id: 's4_rain_delay_penthouse',
      title: 'Barish Ki Raat Aur Boss Ka Naram Dil',
      narration: [
        '*Shivangi presentation dekh kar achanak khadi ho jaati hai. Uski aankhon mein nayi aag daud padti hai.*',
        'Shivangi: "Yeh numbers... tumne kab calculate kiye? Yeh strategy brilliant hai!"',
        '*Usi waqt office ki building ka main power circuit trip hota hai. Emergency warm yellow lights on hoti hain.*',
        '*Shivangi andhere mein tumhare qareeb aakar rukti hai. Uski saansein tez hain.*',
        'Shivangi: "{{playerName}}... agar tum aaj raat yahan nahi hote, toh main sach mein bikhar jaati. Thank you."',
        '*STATUS MILESTONE: ATTRACTION: 45/100 | SHIVANGI\'S MOOD: Vulnerable & Grateful | CURRENT ARC: 2.*'
      ],
      fallbackLines: [
        '*Glass par baarish ki boondein fisal rahi hain.*',
        'Shivangi: "Mujhe akele rehne ki aadat ho gayi thi."'
      ],
      choices: [
        {
          id: 'c4_stand_beside_her',
          text: 'Khidki ke paas uske barabar khade hokar kaho — "Aapko ab akele ladne ki zaroorat nahi hai, Shivangi."',
          shortLabel: 'Akele ladna nahi',
          keywords: ['akele', 'saath', 'shivangi', 'khidki'],
          next: 's5_business_gala_alliance',
          effects: {
            relationships: { shivangi: 14 },
            memory: ['{{playerName}} ne Shivangi ko sahara diya aur uska naam pehli baar akele mein liya.']
          }
        },
        {
          id: 'c4_professional_warmth',
          text: '"Yeh meri duty thi ma\'am. Ab kal board meeting mein inko jawaab dete hain."',
          shortLabel: 'Board ko jawab do',
          keywords: ['duty', 'board', 'kal', 'jawab'],
          next: 's5_business_gala_alliance',
          effects: {
            relationships: { shivangi: 10 },
            memory: ['{{playerName}} ne agle din ki jeet ki tayyari shuru ki.']
          }
        }
      ]
    },
    {
      id: 's5_business_gala_alliance',
      title: 'Corporate Badshahat Aur Dil Ka Safar',
      narration: [
        '*Subah ki pehli dhoop Marine Drive ke samundar par chamakti hai. Board meeting jeet chuki hai.*',
        '*Shivangi apne penthouse cabin mein tumhare sath khadi hai, uske haath mein coffee cup hai aur chehre par ek aisi muskaan jo poore corporate world ne kabhi nahi dekhi.*',
        'Shivangi: "Mera pichla PA bhaag gaya tha, par tum... tum meri aadat bante ja rahe ho, {{playerName}}."',
        '*Uski ungliyan halke se tumhare collar ko theek karti hain.*',
        '*Yeh kahani yahan rukti nahi — aage London gala, board ke rivals ki nayi sazish aur boss aur assistant ke dabe hue romance ke anant panno ka aagaz hai.*'
      ],
      fallbackLines: [
        '*Suraj ki roshni cabin ko golden bana rahi hai.*',
        '*Shivangi ki aankhon mein naya nasha hai.*'
      ],
      choices: [
        {
          id: 'c5_morning_flirt',
          text: 'Halki muskaan ke sath bolo — "Aadat buri nahi hai ma\'am, bas sambhaliye ga."',
          shortLabel: 'Aadat sambhaliye',
          keywords: ['aadat', 'flirt', 'muskaan', 'boss'],
          next: 's1_cabin_first_encounter',
          effects: {
            relationships: { shivangi: 8 },
            memory: ['{{playerName}} ne playful confidence se Shivangi ke sath nayi shuruaat ki.']
          }
        },
        {
          id: 'c5_london_trip_prep',
          text: '"Chaliye London deal sign karne ki flight book karte hain."',
          shortLabel: 'London flight book',
          keywords: ['london', 'deal', 'flight', 'safari'],
          next: 's1_cabin_first_encounter',
          effects: {
            relationships: { shivangi: 7 },
            memory: ['{{playerName}} ne Shivangi ke sath London trip ki planning shuru ki.']
          }
        }
      ]
    }
  ]
};

export const story07 = {
  id: 'playboy-reborn',
  title: 'Playboy Reborn',
  tagline: 'Pichli zindagi mein dhokha aur maut... is zindagi mein taaqat, badla aur naya daur.',
  description: 'Tum {{playerName}} ho. Pichli zindagi mein tum ek aiyash, laparwah playboy the jise apno ne hi loot kar sadak par lada diya. Bhabhi Priya ki meethi meethi baatein, bhai Rajesh ka andha vishwas aur dost Rohan ke peeth peeche khanjar ne tumhari zindagi barbaad kar di thi. Magar kismat ne tumhe doosra mauqa diya — tum achanak apne 19 saal ke jism mein wapas jaagte ho, unhi puraani yaadon aur aane wale bhavishya ke har raaz ke sath. Mission saaf hai: aiyashi chhodkar power, paisa aur influence khada karna, aur har gunehgaar ka hisaab chukana. Aur tabhi Sharma Mansion mein kadam rakhti hai ek nayi taaqat: Natasha Malhotra.',
  genres: ['Rebirth', 'Revenge Drama', 'Wealth', 'Power', 'Family Drama'],
  tags: ['rebirth', 'revenge', 'billionaire', 'family', 'ongoing', 'hinglish'],
  ageRating: '18+',
  contentLevel: 'mature',
  accentColor: '#B45309',
  userRole: '{{playerName}} — 19 saal ke jism mein reborn hua mastermind jiske paas bhavishya ka gyaan aur badle ki aag hai',
  setting: 'Sharma Mansion, South Delhi race course, private corporate auctions, aur luxury hotel suites',
  openingSceneId: 's1_mirror_reawakening',
  tone: 'Ruthless strategic ambition, high society intrigue, calculated romance and power plays.',
  safetyNotes: [
    'Rebirth gives knowledge and opportunities, not instant god-like powers.',
    'Priya is manipulative; Rajesh is weak-willed; Rohan is an opportunistic betrayer.',
    'Natasha is an intelligent adult heiress with her own independent ambitions.',
    'Story is ongoing and expandable across industry hostile takeovers.'
  ],
  characters: [
    {
      id: 'priya',
      name: 'Priya Sharma',
      role: 'Bhabhi — 27 saal ki manipulative aur sweet-talking vixen',
      personality: 'Chehre par behad komal muskaan, par dimaag mein zeher. Pichli zindagi mein usne {{playerName}} ke saare shares apne naam karwaye the.',
      background: 'Rajesh ki patni jo Sharma empire ko secretly apne mayke walon ke naam transfer karne ka plan bana rahi hai.',
      goals: ['Sharma holdings ke voting rights par qabza karna', '{{playerName}} ko aiyash banaye rakhna taaki dimaag na chalaye'],
      fears: ['{{playerName}} ka achanak samajhdar aur serious hona'],
      likes: ['Designer sarees', 'Jewellery', 'Flattery'],
      dislikes: ['Audit reports', 'Smart lawyers'],
      speakingStyle: 'Sweet, velvety, deceitful Hinglish.',
      sampleLine: '{{playerName}} devar ji, aap kitne bhole ho. Apni saari property ki chinta hum par chhod do na.',
      relationshipWithUser: 'Trust: 15/100 (she thinks she controls him, but he knows everything).',
      knowledge: ['Family bank accounts', 'Rajesh weaknesses']
    },
    {
      id: 'rajesh',
      name: 'Rajesh Sharma',
      role: 'Elder Brother — 29 saal ka weak-willed parivar ka bada beta',
      personality: 'Ghamandi par Priya ke haathon ki kathputli. {{playerName}} ko hamesha nalaayak samajhta hai.',
      background: 'Pita ke baad company ka chairman bana par leadership skills zero hain.',
      goals: ['Sharma empire par apna dabdaba dikhana'],
      fears: ['Board members ka inkaar'],
      likes: ['Expensive cars', 'High society clubs'],
      dislikes: ['Chhote bhai ka aage nikalna'],
      speakingStyle: 'Patronizing, condescending Hinglish.',
      sampleLine: '{{playerName}}, tum hamesha aiyashi karte rahoge, business hum sambhalte hain.',
      relationshipWithUser: 'Underestimates {{playerName}} completely.',
      knowledge: ['Company voting trusts']
    },
    {
      id: 'rohan',
      name: 'Rohan',
      role: 'Former Best Friend — 20 saal ka double-crossing college buddy',
      personality: 'Bahar se loyal dost, andar se jealous snake.',
      background: 'Pichli life mein isne car crash plan kiya tha {{playerName}} ke naam par loan lene ke baad.',
      goals: ['{{playerName}} ke paise par maze udaana aur use fasana'],
      fears: ['Expose hona'],
      likes: ['Club VIP passes', 'Expensive booze'],
      dislikes: ['Paisa wapas maangna'],
      speakingStyle: 'Casual fake-friendly Hinglish.',
      sampleLine: 'Bhai aaj raat party mein chalte hain na, bill tu de diyo!',
      relationshipWithUser: 'Major betrayer from past life.',
      knowledge: ['College drug connections', 'Illegal street bets']
    },
    {
      id: 'natasha',
      name: 'Natasha Malhotra',
      role: 'High-Society Heiress & Strategic Ally — 24 saal ki gorgeous, fiercely intelligent businesswoman',
      personality: 'Auburn curls, emerald satin gown, sharp diamond gaze. Kisi ki moh-taaj nahi, Malhotra Group ki asli dimaag. Dikhawa nahi, results dekhti hai.',
      background: 'Malhotra family ki akele waris. Uski family Sharma Group ke prime properties ki auction mein hissa le rahi hai.',
      goals: ['Malhotra empire ko diversify karna', 'Sharma Mansion ki real value pehchanna'],
      fears: ['Wrong corporate alliances'],
      likes: ['Classical auctions', 'Fine horses', 'Sharp intellectual minds'],
      dislikes: ['Spoiled playboys', 'Dishonesty'],
      speakingStyle: 'Sophisticated, seductive yet intellectually challenging Hinglish.',
      sampleLine: 'Maine suna tha tum sirf paise udate ho, {{playerName}}. Par aaj auction mein jo daav tumne khela... woh koi shatir khiladi hi khel sakta hai.',
      relationshipWithUser: 'Empire Control & Attraction progression. High potential queen ally.',
      knowledge: ['Upcoming state infrastructure tenders', 'Foreign venture funds']
    }
  ],
  world: {
    premise: 'Pichli zindagi mein dhokha, qarz aur hadse mein jaan gawa chuka {{playerName}} apne 19 saal ke jism mein wapas jaagta hai. Uske paas 7 saal ka future stock market ka gyaan, Priya bhabhi ke saare traps aur Rohan ke dhokhe ki sachai hai. Ek ek karke badla lena aur Sharma empire ka asli badshah banna uska sankalp hai.',
    locations: [
      { id: 'sharma-mansion', name: 'Sharma Mansion, Civil Lines', description: 'Garam teak wood aur marble se bani haveli jahan parivar ke andar aag sulagti hai.' },
      { id: 'race-course', name: 'Delhi Race Club VIP Lounge', description: 'Jahan high society ke arabon ke saude khamoshi se hote hain.' },
      { id: 'auction-house', name: 'Imperial Heritage Auction Hall', description: 'Jahan Natasha Malhotra se pehla aamna-saamna hota hai.' }
    ],
    factions: [
      { id: 'malhotra-group', name: 'Malhotra Conglomerate', description: 'North India ka sabse taaqatwar business house jise Natasha lead karti hai.' },
      { id: 'sharma-holdings', name: 'Sharma Holdings Ltd', description: 'Parivarik company jiske shares ke liye aapsi yudh chal raha hai.' }
    ],
    lore: [
      'Pichli zindagi mein aaj hi ke din Priya ne factory transfer papers par sign karwaye the.',
      'Agle teen hafte mein tech stock ' + 'InfraNet' + ' 400 percent jump karega.'
    ],
    rules: [
      'Knowledge is weapon; player must build leverage step by step.',
      'Natasha will not instantly fall in love; she respects dominance and intellect.',
      'Ongoing story without permanent termination.'
    ],
    importantObjects: [
      { id: 'black-diary', name: 'Future Memory Ledger', description: 'Pichli zindagi ke ahem stock crash aur political scam dates jo {{playerName}} ne note kiye.' }
    ],
    timeline: [
      '19 saal ke jism mein rebirth.',
      'Priya bhabhi ke sign attempt ko defeat karna.',
      'Natasha Malhotra se auction encounter aur power building.'
    ]
  },
  memory: {
    shortTermWindow: 14,
    seedMemories: [
      '{{playerName}} 19 saal ke jism mein past memories ke sath rebirth hua hai.',
      'Pichli zindagi mein Priya, Rajesh aur Rohan ne use barbaad kiya tha.',
      'Stats: Empire Control: 5/100 | Priya Mood: Sweet Poison | Natasha Attraction: Unmet.'
    ],
    extractionHints: ['Rebirth knowledge', 'Revenge milestones', 'Natasha alliance moves', 'Financial stocks'],
    neverRemember: ['Real-world passwords', 'Personal bank pins']
  },
  scenes: [
    {
      id: 's1_mirror_reawakening',
      title: 'Aaine Mein Rebirth Aur Priya Ka Jaal',
      narration: [
        '*Sharma Mansion ka master bedroom. Tum tezi se uthte ho, saansein phooli hui aur jism pasine se tar-batar. Aakhri yaad: road par barish, car crash aur Rohan ki hasi.*',
        '*Tum aaine ke samne khade hote ho. Saamne 19 saal ka tumhara apna chehra hai — wahi jawani, wahi chamak, par ankhon mein maut dekh chuke insaan ki thandak.*',
        '*Date dekhte ho phone par: theek saat saal pehle ka din! Wahi din jab Priya bhabhi ne pehli baar tumse factory ke transfer papers par sign karwaye the.*',
        '*Darwaza khulta hai. Priya bhabhi silk saree mein aati hain, labon par wahi mithi muskaan aur haath mein juice ka glass.*',
        'Priya: "{{playerName}} devar ji! Uth gaye aap? Rajesh keh raha tha ki aaj aapko club nahi jaana chahiye, par maine kaha mera ladla thodi rukega. Waise... ye chote se legal papers par sign kar dete toh kitna achha hota?"',
        '*PROGRESSION: Empire Control: 5/100 | NPC Mood (Priya): Suspiciously Sweet | Attraction (Natasha): Unmet | Current Objective: Reclaim Sharma Holdings.*'
      ],
      fallbackLines: [
        '*Priya pen aage badhati hai, uski ankhon mein lalach chamakta hai.*',
        'Priya: "Sign kar do na {{playerName}}, bas ek formality hai."'
      ],
      choices: [
        {
          id: 'c1_refuse_signing',
          text: 'Papers haath mein lekar padho aur muskurate hue mana kar do — "Bhabhi, business ke papers bina lawyer ke padhe sign karna aiyash ladkon ka kaam hai, mera nahi."',
          shortLabel: 'Sign karne se roko',
          keywords: ['lawyer', 'business', 'bhabhi', 'mana'],
          next: 's2_refuse_signing',
          effects: {
            relationships: { priya: -5 },
            flags: { rejectedPriyaTrap: true },
            memory: ['{{playerName}} ne pehle hi din Priya ke transfer papers par sign karne se saaf inkaar kiya.']
          }
        },
        {
          id: 'c1_play_fool',
          text: 'Acting karte hue bhole bano — "Arrey bhabhi, abhi toh sar ghoom raha hai. Shaam ko party ke baad dekhte hain."',
          shortLabel: 'Bhola ban kar taalo',
          keywords: ['sar ghoom', 'acting', 'shaam', 'party'],
          next: 's2_play_fool',
          effects: {
            relationships: { priya: 2 },
            flags: { playedDumb: true },
            memory: ['{{playerName}} ne bhola bankar Priya ko andhere mein rakha.']
          }
        },
        {
          id: 'c1_confront_early',
          text: 'Seedha unki ankhon mein dekho — "Rajesh bhaiya ko kahiye ki khud aakar baat karein... deal ab barabar ki hogi."',
          shortLabel: 'Bhaiya ko bulao',
          keywords: ['rajesh', 'bhaiya', 'deal', 'barabar'],
          next: 's2_confront_early',
          effects: {
            relationships: { priya: -8 },
            flags: { confrontedPriya: true },
            memory: ['{{playerName}} ne Priya ko saaf bola ki Rajesh khud aakar baat kare.']
          }
        }
      ]
    },
    {
      id: 's2_refuse_signing',
      title: 'Priya Ki Muskaan Ka Rang Badla',
      narration: [
        '*Priya ke chehre ki mithi muskaan ek second ke liye jam jaati hai. Uski aankhein choti hoti hain.*',
        'Priya: "Lawyer? {{playerName}}, tum parivar ke beech lawyer laoge? Tumhe humpar bharosa nahi raha kya?"',
        '*Tum juice ka glass lete ho, par peete nahi. Pichli zindagi mein isme halka sa sleeping drop hota tha.*',
        '*Tum: "Bharosa bohot mehenga hota hai Bhabhi, aur main ab saste saude nahi karta."*',
        '*Priya ke gale se ghoont utarta hai. Use ehsaas hota hai ki samne khada ladka ab pehle wala be-aqal playboy nahi raha.*'
      ],
      fallbackLines: [
        '*Priya papers wapas folder mein rakhti hai.*',
        'Priya: "Lagta hai kal raat ki party ka nasha abhi utra nahi tumhara."'
      ],
      choices: [
        {
          id: 'c2_call_out_rohan',
          text: 'Phone nikaalo jahan Rohan ka incoming call aa raha hai — "Aaj shaam ka plan cancel."',
          shortLabel: 'Rohan ko side karo',
          keywords: ['rohan', 'call', 'cancel', 'party'],
          next: 's3_rohan_trap',
          effects: {
            relationships: { rohan: -10 },
            memory: ['{{playerName}} ne Rohan ke sath club jaane ka plan cancel kar diya.']
          }
        },
        {
          id: 'c2_mention_board_meeting',
          text: '"Rajesh bhaiya se kehna main aaj dopahar ki board meeting mein aane wala hoon."',
          shortLabel: 'Board meeting jao',
          keywords: ['board', 'meeting', 'rajesh', 'dopahar'],
          next: 's3_rohan_trap',
          effects: {
            relationships: { priya: -5 },
            memory: ['{{playerName}} ne pehli baar company board meeting mein baithne ka elaan kiya.']
          }
        }
      ]
    },
    {
      id: 's2_play_fool',
      title: 'Dabe Paanv Shikaar Ki Taiyyari',
      narration: [
        '*Priya halki hansi hasti hai aur tasalli ki saans leti hai.*',
        'Priya: "Chalo theek hai, shaam ko club jaane se pehle sign kar dena. Tumhara dost Rohan abhi phone kar raha tha, keh raha tha VIP table book ho gayi hai."',
        '*Tum man hi man muskurate ho: "Rohan... pichli zindagi mein tune isi table par mujhe drugs ke case mein phasaya tha."*',
        '*Tumhara dimaag second life ki pehli strategic counter-move tayyar karta hai.*'
      ],
      fallbackLines: [
        '*Priya kamre se nikal jaati hai.*',
        '*Tum turant apne personal safe ki taraf badhte ho.*'
      ],
      choices: [
        {
          id: 'c2_prepare_trap_rohan',
          text: 'Private detective ko phone karke Rohan par surveillance lagao',
          shortLabel: 'Rohan par spy lagao',
          keywords: ['spy', 'rohan', 'detective', 'trap'],
          next: 's3_rohan_trap',
          effects: {
            relationships: { rohan: -15 },
            memory: ['{{playerName}} ne Rohan ke khilaaf surveillance set kar di.']
          }
        },
        {
          id: 'c2_invest_infranet',
          text: 'Puraana trading account khol kar InfraNet stock par saari savings lagao',
          shortLabel: 'InfraNet stock lo',
          keywords: ['stock', 'infranet', 'trading', 'shares'],
          next: 's3_rohan_trap',
          effects: {
            flags: { boughtInfraNet: true },
            memory: ['{{playerName}} ne 7 saal pehle ke secret knowledge se InfraNet stock khareeda.']
          }
        }
      ]
    },
    {
      id: 's2_confront_early',
      title: 'Bhaiya Ka Gussa Aur Nayi Hawa',
      narration: [
        '*Priya darwaza khol kar Rajesh ko bulati hai. Rajesh gusse mein bedroom mein dakhil hota hai.*',
        'Rajesh: "{{playerName}}, yeh kya badtameezi hai? Priya tumhare bhale ke liye papers laayi thi aur tum yahan shartein rakh rahe ho?"',
        '*Tum aage badhte ho. Tumhara 19 saal ka shareer unche kad ke sath ek intimidating aura deta hai.*',
        '*Tum: "Rajesh bhaiya, pita ji ki vasiyat ke mutabiq factory ka 40 percent share mera hai. Agar bechna hai toh market rate par becho, Priya bhabhi ke bhai ko muft mein nahi."*',
        '*Rajesh ka chehra peela pad jaata hai — yeh secret sirf Priya aur uske beech tha!*'
      ],
      fallbackLines: [
        '*Rajesh ki aawaz ladkhadati hai.*',
        'Rajesh: "Yeh... yeh baat tumhe kisne bataayi?"'
      ],
      choices: [
        {
          id: 'c2_strike_fear',
          text: '"Mere paas saare kacha-chithe hain bhaiya. Apni maryada mein rahiye."',
          shortLabel: 'Maryada yaad dilao',
          keywords: ['maryada', 'kacha chitha', 'khauf', 'sharma'],
          next: 's3_rohan_trap',
          effects: {
            relationships: { rajesh: -10 },
            memory: ['{{playerName}} ne Rajesh aur Priya ki secret deal expose kar di.']
          }
        },
        {
          id: 'c2_strategic_silence',
          text: 'Dheere se muskura kar kamre se nikal jao — "Shaam ki auction mein milte hain."',
          shortLabel: 'Auction mein milo',
          keywords: ['auction', 'shaam', 'muskaan', 'exit'],
          next: 's3_rohan_trap',
          effects: {
            flags: { headedToAuction: true },
            memory: ['{{playerName}} ne shaam ki heritage auction ka elaan kiya.']
          }
        }
      ]
    },
    {
      id: 's3_rohan_trap',
      title: 'Rohan Ka Confrontation Aur Auction Ka Daav',
      narration: [
        '*Dopahar ko Sharma Mansion ke porch par Rohan apni sporty bike par aata hai.*',
        'Rohan: "Bhai {{playerName}}! Jaldi chal na, aaj raat club mein full setting hai! Maine sab manage kar liya hai."',
        '*Tum uske kandhe par haath rakhte ho, giraft itni mazboot hoti hai ki Rohan ka chehra thoda dard se sikudta hai.*',
        '*Tum: "Club nahi Rohan. Aaj hum Imperial Heritage Auction House chal rahe hain. Wahan asli khiladi aate hain."*',
        '*Auction House ke grand gate par expensive Maybachs aur Bentleys ki line lagi hai. Aur tabhi ek emerald satin gown mein car se utarti hai — Natasha Malhotra.*'
      ],
      fallbackLines: [
        '*Natasha ke auburn curls hawa mein lehrate hain.*',
        'Natasha: "Sharma family ka playboy bhi auction mein aane laga?"'
      ],
      choices: [
        {
          id: 'c3_meet_natasha',
          text: 'Rohan ko chhod kar seedha Natasha ke samne jao aur aadaab pesh karo',
          shortLabel: 'Natasha se milo',
          keywords: ['natasha', 'aadaab', 'malhotra', 'auction'],
          next: 's4_natasha_auction_arrival',
          effects: {
            relationships: { natasha: 8 },
            memory: ['{{playerName}} ne Natasha Malhotra ke samne shandar first impression banaya.']
          }
        },
        {
          id: 'c3_dismiss_rohan_publicly',
          text: 'Rohan ko sabke samne apni chabi thama kar bolo — "Gaadi park karke aao, Rohan."',
          shortLabel: 'Rohan ko valet banao',
          keywords: ['valet', 'chabi', 'rohan', 'park'],
          next: 's4_natasha_auction_arrival',
          effects: {
            relationships: { rohan: -20, natasha: 10 },
            flags: { putRohanInPlace: true },
            memory: ['{{playerName}} ne Rohan ko sabke samne parking valet ki aukaat dikha di, jise dekh kar Natasha muskura di.']
          }
        }
      ]
    },
    {
      id: 's4_natasha_auction_arrival',
      title: 'Natasha Ki Teekhi Nazar Aur Boli Ka Khel',
      narration: [
        '*Auction Hall ke chandeliers ki roshni mein hazaaron croron ke saude chal rahe hain. Natasha Malhotra VIP front row mein baithi hai.*',
        '*Stage par Sharma family ke purane ancestral hotel ki bidding shuru hoti hai. Rajesh aur Priya piche baith kar saste mein bechne ki koshish kar rahe hain.*',
        '*Natasha 50 crore ki boli lagati hai. Tabhi tumhara haath paddle uthata hai.*',
        '*Tum: "120 Crore Cash."*',
        '*Poore hall mein sannata chha jaata hai. Natasha ghoom kar tumhari ankhon mein dekhti hai — uski emerald ankhon mein pehli baar kisi mard ke liye sacchi hairani aur challenge dikhta hai.*'
      ],
      fallbackLines: [
        '*Auctioneer ka hammer hawa mein ruk jata hai.*',
        'Natasha: "Boli lagana aasan hai, {{playerName}}... bank guarantee kahan hai tumhari?"'
      ],
      choices: [
        {
          id: 'c4_present_infranet_gains',
          text: 'InfraNet ke din-dopahar 400% profit ki live trade screen Natasha ke aage karo',
          shortLabel: 'Live trade dikhao',
          keywords: ['trade', 'infranet', 'profit', 'guarantee'],
          next: 's5_first_empire_move',
          effects: {
            relationships: { natasha: 15 },
            flags: { backedUpBid: true },
            memory: ['{{playerName}} ne 7 saal ke future stock trade se live cash backing dikha kar Natasha ke hosh uda diye.']
          }
        },
        {
          id: 'c4_offer_partnership_natasha',
          text: '"Main yeh property akele nahi khareed raha, Miss Malhotra. 50-50 partnership ka offer hai."',
          shortLabel: '50-50 deal offer',
          keywords: ['deal', 'partnership', 'natasha', '50-50'],
          next: 's5_first_empire_move',
          effects: {
            relationships: { natasha: 12 },
            memory: ['{{playerName}} ne Natasha ko direct strategic business partnership ka offer diya.']
          }
        }
      ]
    },
    {
      id: 's5_first_empire_move',
      title: 'Badshah Ki Nayi Hukumat Ka Aagaz',
      narration: [
        '*Natasha Malhotra chair se uthti hai aur apna haath tumhari taraf badhati hai. Uski diamond rings ki chamak uski ankhon se kam hai.*',
        'Natasha: "Sharma parivar ke aiyash ladke ki aisi taakat aur dimaag... maine expect nahi kiya tha. Partner banne ka offer mujhe manzoor hai, {{playerName}}."',
        '*Peeche se Rajesh aur Priya ka chehra kaala pad chuka hai. Unka poora plan mitti mein mil gaya.*',
        '*PROGRESSION UPDATE: Empire Control: 35/100 | Natasha Attraction: 40/100 | Objective: Malhotra Alliance Formed!*',
        '*Yeh kahani yahan rukti nahi — agle rounds mein board control ka dabdaba, Rohan ke illegal traps ka pardafash aur Natasha ke sath corporate badshahat ka safar jari rahega.*'
      ],
      fallbackLines: [
        '*Auction hall mein log tumhare naam ki charcha kar rahe hain.*',
        '*Priya aur Rajesh ki dabi cheekh saaf mehsoos ho rahi hai.*'
      ],
      choices: [
        {
          id: 'c5_toast_with_natasha',
          text: 'Natasha ke sath champagne glass toast karo aur kaho — "Yeh bas shuruaat hai."',
          shortLabel: 'Champagne toast karo',
          keywords: ['toast', 'champagne', 'natasha', 'shuruaat'],
          next: 's1_mirror_reawakening',
          effects: {
            relationships: { natasha: 8 },
            memory: ['{{playerName}} ne Natasha ke sath agle empire moves ke liye toast kiya.']
          }
        },
        {
          id: 'c5_eye_betrayers',
          text: 'Priya aur Rajesh ki taraf dekh kar ek thandi kaatne wali muskaan do',
          shortLabel: 'Dushmanon ko dekho',
          keywords: ['priya', 'rajesh', 'revenge', 'muskaan'],
          next: 's1_mirror_reawakening',
          effects: {
            relationships: { priya: -5, rajesh: -5 },
            memory: ['{{playerName}} ne apne puraane gunehgaron ko aage aane wale toofan ka paigham diya.']
          }
        }
      ]
    }
  ]
};

export const story08 = {
  id: 'stuck-between-angel-and-devil',
  title: 'Stuck Between Angel & Devil',
  tagline: 'TV screen ki roshni mein khinchi aisi duniya... jahan ek taraf pari hai aur doosri taraf toofan.',
  description: 'Tum {{playerName}} ho — aadhi raat ko apne kamre mein baith kar apna favorite K-Drama dekh rahe the. Achanak TV screen ajeeb tareeqe se chamakne lagti hai, ek taaqatwar gravitational force tumhe khinch leti hai, aur jab tumhari aankhein khulti hain, tum Seoul ki Haneul University ke campus mein khade ho. Sab tumhe wahi ke ek handsome student ke roop mein jaante hain. Pehle hi din tumhari zindagi mein do behad khoobsurat ladkiyan aati hain: Kim Si-woo ("Angel") — naram dil, volunteer leader, sweet smile wali pari; aur Lee Yu-na ("Devil") — leather jacket, rebellious gaze aur dark eyeliner wali bad-girl jo tumhare har raaz ko dhoondh nikalna chahti hai. K-Drama ki is anokhi duniya mein tum kiske kareeb jaoge?',
  genres: ['K-Drama Fantasy', 'Romance', 'College', 'Comedy'],
  tags: ['k-drama', 'isekai', 'college', 'love-triangle', 'ongoing', 'hinglish'],
  ageRating: '12-17',
  contentLevel: 'teen',
  accentColor: '#A855F7',
  userRole: '{{playerName}} — ek aam ladka jo K-Drama ki duniya mein transmigrate ho gaya aur do anokhi ladkiyon ke beech phans gaya',
  setting: 'Haneul University campus, Seoul — cherry blossom garden, student lounge, neon street food alley',
  openingSceneId: 's1_haneul_university_awakening',
  tone: 'Charming K-Drama aesthetic, vibrant college romance, Hinglish comedic beats and emotional warmth.',
  safetyNotes: [
    'Both female leads are distinct, layered, adult college students with personal agency.',
    'No cheap stereotypes: Si-woo has hidden pressure, Yu-na has hidden warmth.',
    'Light-hearted teen-friendly romance with atmospheric aesthetic.',
    'Story is ongoing and expandable into music competitions and campus festivals.'
  ],
  characters: [
    {
      id: 'siwoo',
      name: 'Kim Si-woo',
      role: 'The Angel / Student Council Volunteer Head — 20 saal ki gentle, radiant aur caring ladki',
      personality: 'Soft cream cardigan, braided chestnut brown hair, dimpled warm smile. Dil ki behad saaf, har kisi ki madad karti hai, par khud ke upar family expectations aur perfectionism ka bojh chhupa kar rakhti hai.',
      background: 'Haneul University ke dean ki beti, hamesha perfect model student banna padta hai.',
      goals: [
        'Campus mein sabko safe aur khush rakhna',
        '{{playerName}} ko campus mein comfortable mehsoos karwana',
        'Apni sachhi khwahishein pehchan kar azaad hona'
      ],
      fears: ['Galti karna aur logon ko disappoint karna', 'Apne parivar ki umeedon par khara na utarna'],
      likes: ['Strawberry milk', 'Cherry blossoms', 'Warm green tea', 'Kind-hearted gestures'],
      dislikes: ['Rude aur loud behavior', 'Kisi ko hurt hote dekhna'],
      speakingStyle: 'Polite, sweet, melodic Hinglish with soft touches.',
      sampleLine: '{{playerName}}-ssi! Aap theek toh hain na? Subah se aap thode khoye-khoye lag rahe hain... yeh warm tea lijiye na.',
      relationshipWithUser: 'Gentle affection, pure warmth, and unspoken shy interest.',
      knowledge: ['Campus faculty layout', 'Dean office secret memos']
    },
    {
      id: 'yuna',
      name: 'Lee Yu-na',
      role: 'The Devil / Rebellious Music Major — 20 saal ki sharp, fearless aur unpredictable bad-girl',
      personality: 'Black cropped leather jacket, layered shoulder-length raven hair with violet streaks, intense dark eyeliner. Unconventional, observant, sarcastic, kisi ke aage nahi jhukti.',
      background: 'Underground indie rock band ki lead guitarist. Society ke fake rules se nafrat karti hai.',
      goals: [
        'Apna indie music label launch karna',
        '{{playerName}} ke achanak badle hue andaz ka raaz pata lagana',
        'Si-woo ke fake perfectionism ko tod kar use azaad karna'
      ],
      fears: ['Apni freedom kho dena', 'Kisi par sach mein bharosa karke hurt hona'],
      likes: ['Electric guitars', 'Late-night spicy tteokbokki', 'Fast skateboards', 'Fearless honesty'],
      dislikes: ['Fake sweetness', 'Strict curfews', 'Boring lectures'],
      speakingStyle: 'Edgy, witty, fast Hinglish with teasing smirk.',
      sampleLine: 'Oye drama king {{playerName}}! Kal tak toh tum mujhe dekh kar rasta badal lete the, aaj achanak hero banne ki koshish kar rahe ho?',
      relationshipWithUser: 'Teasing rivalry turning into electric chemistry.',
      knowledge: ['Underground Hongdae music clubs', 'University dark secrets']
    }
  ],
  world: {
    premise: 'Aadhi raat ko K-Drama dekhte hue {{playerName}} TV screen ke portal ke zariye transmigrate hokar Seoul ki Haneul University mein pahunch jaata hai. Wahan use sab ek handsome Korean student ke roop mein jaante hain. Pehle hi din sweet gentle Si-woo aur rebellious badass Yu-na ke beech phas kar ek mazedaar aur romantic safar shuru hota hai.',
    locations: [
      { id: 'cherry-blossom-path', name: 'Cherry Blossom Promenade', description: 'Gulabi pankhudiyon se bhara campus ka main walking track.' },
      { id: 'music-practice-room', name: 'Underground Band Practice Room B3', description: 'Sound-proof basement jahan Yu-na apni electric guitar bajati hai.' },
      { id: 'student-union-lounge', name: 'Volunteer Center & Lounge', description: 'Jahan Si-woo chai aur first-aid kits rakhti hai.' }
    ],
    factions: [
      { id: 'student-council', name: 'Haneul Student Council', description: 'Strict traditional rules follow karne wali official student body.' },
      { id: 'indie-rebels', name: 'Hongdae Underground Scene', description: 'College ke baagi musicians aur artists ka circle.' }
    ],
    lore: [
      'Is K-Drama ke original script mein main character ko ek accident mein hospital jaana tha, par {{playerName}} ke aane se storyline divert ho gayi.',
      'Si-woo aur Yu-na bachpan mein padosi thi, par high school mein unki dosti toot gayi thi.'
    ],
    rules: [
      'Si-woo is the Angel archetype with depth; Yu-na is the Devil archetype with a warm core.',
      'Player choices influence who he spends time with, balancing both relationships.',
      'Story is ongoing without permanent endings.'
    ],
    importantObjects: [
      { id: 'k-drama-phone', name: 'Transmigrated Smartphone', description: 'Ek sleek Korean phone jismein upcoming drama episode hints pop-up notifications ke roop mein aati hain.' }
    ],
    timeline: [
      'TV screen ke zariye K-Drama mein transmigration.',
      'Haneul University campus mein Si-woo aur Yu-na se pehli takkar.',
      'Campus festival duet aur Hongdae night market exploration.'
    ]
  },
  memory: {
    shortTermWindow: 14,
    seedMemories: [
      '{{playerName}} K-Drama ke andar transmigrate hokar Haneul University pahuncha hai.',
      'Kim Si-woo ek sweet caring Angel hai, jabki Lee Yu-na ek rebellious cool Devil hai.',
      'Both girls noticed that the character behaves differently and are curious about him.'
    ],
    extractionHints: ['Angel vs Devil choices', 'Si-woo secret pressures', 'Yu-na music moments', 'Drama script alterations'],
    neverRemember: ['Real-world passwords', 'Personal bank pins']
  },
  scenes: [
    {
      id: 's1_haneul_university_awakening',
      title: 'Cherry Blossoms Aur Do Khoobsurat Musibatein',
      narration: [
        '*Aadhi raat ka kamra, TV screen ki roshni aur phir ek behad tezi se kheenchti hui vortex. Tum {{playerName}} ho.*',
        '*Jab tumhari aankhein khulti hain, gulabi cherry blossom ki pankhudiyan hawa mein ud rahi hain. Saamne red-brick heritage building par likha hai: "Haneul University, Seoul".*',
        '*Tumne apna haath dekha — wahi stylish beige trench coat aur student ID card: tum ab is K-Drama ke main character ki body mein ho!*',
        '*Tabhi ek naram, sweet aawaz sunayi deti hai. Ek ladki — soft cream cardigan aur braided baalon mein behad cute — tumhare samne aati hai: Kim Si-woo.*',
        'Si-woo: "{{playerName}}-ssi! Aap yahan khade hain? Maine aapko library mein dhoondha... aapka chehra itna utra hua kyun hai? Sab theek toh hai na?"',
        '*Isse pehle ki tum kuch bolo, bagal se ek skateboard aakar rukti hai. Black leather jacket, dark eyeliner aur hothon par naughty smirk ke sath aati hai Lee Yu-na.*',
        'Yu-na: "Arey waah Si-woo, abhi se bodyguard ban gayi iski? Aur tum {{playerName}}... subah se ajeeb bhoot ki tarah sabko ghoor kyun rahe ho? Koi naya drama shuru kiya hai kya?"'
      ],
      fallbackLines: [
        '*Dono ladkiyan tumhari taraf dekh rahi hain.*',
        'Yu-na: "Bolo hero, zubaan freeze ho gayi kya?"'
      ],
      choices: [
        {
          id: 'c1_siwoo_approach',
          text: 'Si-woo ki taraf muskura kar naram jawab do — "Main theek hoon Si-woo, bas campus ki khoobsurti dekh raha tha."',
          shortLabel: 'Si-woo ko muskaan do',
          keywords: ['siwoo', 'naram', 'muskaan', 'campus'],
          next: 's2_siwoo_approach',
          effects: {
            relationships: { siwoo: 8, yuna: 2 },
            flags: { leanedAngel: true },
            memory: ['{{playerName}} ne pehle Si-woo ko sweet aur naram tareeqe se jawab diya.']
          }
        },
        {
          id: 'c1_yuna_approach',
          text: 'Yu-na ki tease ka uske hi andaz mein jawab do — "Tumhe dekhne ke liye kisi bahane ki zaroorat thodi hai, Yu-na."',
          shortLabel: 'Yu-na se bold banter',
          keywords: ['yuna', 'bahana', 'banter', 'bold'],
          next: 's2_yuna_approach',
          effects: {
            relationships: { yuna: 9, siwoo: 2 },
            flags: { leanedDevil: true },
            memory: ['{{playerName}} ne Yu-na ko uske hi rebellious andaz mein sharp flirtatious jawab diya.']
          }
        },
        {
          id: 'c1_kdrama_confusion',
          text: 'Dono ko dekh kar nervous hansi do — "Sach kahun toh mujhe lag raha hai main kisi sapne mein aa gaya hoon."',
          shortLabel: 'Sapne jaisa lag raha',
          keywords: ['sapna', 'hansi', 'nervous', 'dono'],
          next: 's2_kdrama_confusion',
          effects: {
            relationships: { siwoo: 5, yuna: 5 },
            flags: { neutralCuteReaction: true },
            memory: ['{{playerName}} ne nervous hansi ke sath dono ko confuse kiya.']
          }
        }
      ]
    },
    {
      id: 's2_siwoo_approach',
      title: 'Pari Ki Mamta Aur Warm Green Tea',
      narration: [
        '*Si-woo ke chehre par ek pyaari si laali chha jaati hai. Woh apne tote bag se ek thermos nikaal kar tumhare haathon mein thama deti hai.*',
        'Si-woo: "Yeh lijiye, honey aur lemon tea hai. Subah ki thand mein aapki tabiyat kharab ho sakti thi. Aur... waise bhi, aap acche lag rahe hain aaj."',
        '*Yu-na skateboard ko pair se flip karke haath mein pakadti hai aur aankhein ghumati hai.*',
        'Yu-na: "Ew, itni sweetness se toh mere daanton mein cavity ho jayegi! Par suno {{playerName}}, agar is angel ke lecture se bachna ho toh shaam ko Hongdae wale club aa jaana."'
      ],
      fallbackLines: [
        '*Si-woo apna thermos pakadte hue sharmaati hai.*',
        'Si-woo: "Yu-na, please har waqt unhe chidhaya mat karo."'
      ],
      choices: [
        {
          id: 'c2_thank_siwoo_deeply',
          text: '"Shukriya Si-woo, tumhara dhyan rakhna dil ko chhoo gaya."',
          shortLabel: 'Tea ke liye shukriya',
          keywords: ['shukriya', 'siwoo', 'tea', 'dil'],
          next: 's3_cafeteria_clash',
          effects: {
            relationships: { siwoo: 8 },
            memory: ['{{playerName}} ne Si-woo ki tea ke liye dil se shukriya ada kiya.']
          }
        },
        {
          id: 'c2_wink_at_yuna',
          text: 'Si-woo se chai lete hue Yu-na ko wink karo — "Hongdae mein milte hain."',
          shortLabel: 'Yu-na ko wink karo',
          keywords: ['wink', 'hongdae', 'yuna', 'shaam'],
          next: 's3_cafeteria_clash',
          effects: {
            relationships: { yuna: 8, siwoo: 3 },
            memory: ['{{playerName}} ne Yu-na ko Hongdae milne ka playful ishaara kiya.']
          }
        }
      ]
    },
    {
      id: 's2_yuna_approach',
      title: 'Devil Ki Smirk Aur Electric Spark',
      narration: [
        '*Yu-na ke chehre par ek shocked expression aakar turant ek naughty muskaan mein badal jaata hai.*',
        '*Woh do kadam aage aati hai, uske leather jacket ki zipper halki khuli hai aur aankhon mein dark eyeliner ka gehra nasha.*',
        'Yu-na: "Oho! Bille ne aaj achanak panja nikaal liya? Tumhari yeh confident aawaz mujhe pasand aayi, {{playerName}}."',
        '*Si-woo achanak beech mein aati hai, uske chehre par halki chinta aur possessiveness dikhti hai.*',
        'Si-woo: "Yu-na, inka pehla din hai semester ka! Inhe class ke bajaye apne band mein mat ghaseeto."'
      ],
      fallbackLines: [
        '*Yu-na chewing gum ka bubble phodti hai.*',
        'Yu-na: "Boring class se toh meri guitar chords hazaar guna behtar hain."'
      ],
      choices: [
        {
          id: 'c2_praise_yuna_style',
          text: '"Mujhe rock music pasand hai, Yu-na. Tumhari guitar sunna chahta hoon."',
          shortLabel: 'Guitar sunna chahta',
          keywords: ['guitar', 'music', 'yuna', 'pasand'],
          next: 's3_cafeteria_clash',
          effects: {
            relationships: { yuna: 10 },
            memory: ['{{playerName}} ne Yu-na ke rock music ki tareef ki.']
          }
        },
        {
          id: 'c2_reassure_siwoo',
          text: 'Si-woo ka hath thaam kar kaho — "Class attend karunga Si-woo, tension mat lo."',
          shortLabel: 'Si-woo ko tasalli',
          keywords: ['siwoo', 'class', 'attend', 'tension'],
          next: 's3_cafeteria_clash',
          effects: {
            relationships: { siwoo: 8 },
            memory: ['{{playerName}} ne Si-woo ko class attend karne ki tasalli di.']
          }
        }
      ]
    },
    {
      id: 's2_kdrama_confusion',
      title: 'K-Drama Protagonist Ki Uljhan',
      narration: [
        '*Tumhari ajeeb si bholi baat sun kar dono ladkiyan ek doosre ko dekhti hain aur phir hasne lagti hain.*',
        'Si-woo: "Sapna? Kaisa sapna, {{playerName}}-ssi? Kya aapne saari raat games kheli thi?"',
        'Yu-na: "Haha! Yeh banda sach mein cute hai jab bewildered hota hai."',
        '*Usi pal tumhare coat ki pocket mein rakha phone ek subtle notification tone bajaata hai.*',
        '*PHONE ALERT: "Script Event Altered! Episode 1 Choice: Cafeteria Lunch Date with Angel OR Rooftop Rebellion with Devil."*'
      ],
      fallbackLines: [
        '*Campus bell bajne lagti hai.*',
        'Si-woo: "Lecture shuru hone wala hai!"'
      ],
      choices: [
        {
          id: 'c2_ask_about_lunch',
          text: '"Chalo lecture ke baad cafeteria mein lunch karte hain sabhi."',
          shortLabel: 'Cafeteria chalo',
          keywords: ['lunch', 'cafeteria', 'lecture', 'chalo'],
          next: 's3_cafeteria_clash',
          effects: {
            relationships: { siwoo: 6, yuna: 6 },
            memory: ['{{playerName}} ne dono ke sath cafeteria lunch plan banaya.']
          }
        },
        {
          id: 'c2_check_phone_hints',
          text: 'Phone ke notification script ko chupke se check karo',
          shortLabel: 'Script check karo',
          keywords: ['script', 'phone', 'drama', 'hints'],
          next: 's3_cafeteria_clash',
          effects: {
            flags: { checkedScript: true },
            memory: ['{{playerName}} ne drama script notification ko pehle hi scan kar liya.']
          }
        }
      ]
    },
    {
      id: 's3_cafeteria_clash',
      title: 'Cafeteria Ka Mahaul Aur Spicy Tteokbokki',
      narration: [
        '*Haneul University cafeteria. Glass windows ke bahar dhoop khili hai. Table par do dishes rakhi hain.*',
        '*Ek taraf Si-woo ka lovingly pack kiya gaya homemade healthy bento box jismein heart-shaped tamagoyaki hai.*',
        '*Doosri taraf Yu-na ki le aayi hui extra spicy street tteokbokki jismein se laal mirch ki dhuandhaar steam nikal rahi hai.*',
        'Si-woo: "Aapke health ke liye yeh bento accha hai, {{playerName}}-ssi. Maine subah khud banaya tha."',
        'Yu-na: "Arey mard bano {{playerName}}! Asli thrill is fiery tteokbokki mein hai. Kha kar dikhao agar dum hai!"'
      ],
      fallbackLines: [
        '*Cafeteria ke doosre students tumhari table ko dekh rahe hain.*',
        'Yu-na: "Bolo, angel ka pyaar ya devil ki aag?"'
      ],
      choices: [
        {
          id: 'c3_eat_siwoo_bento',
          text: 'Si-woo ka bento pehle chakho aur kaho — "Yeh behad swadisht aur pyara hai, Si-woo."',
          shortLabel: 'Si-woo ka bento khao',
          keywords: ['bento', 'siwoo', 'healthy', 'swadisht'],
          next: 's4_rainy_bus_shelter',
          effects: {
            relationships: { siwoo: 10, yuna: -2 },
            memory: ['{{playerName}} ne Si-woo ka homemade bento khilaya aur uski mehnat ki tareef ki.']
          }
        },
        {
          id: 'c3_brave_spicy_yuna',
          text: 'Yu-na ki challenge par spicy tteokbokki utha kar direct kha jao',
          shortLabel: 'Tteokbokki khao',
          keywords: ['tteokbokki', 'spicy', 'yuna', 'challenge'],
          next: 's4_rainy_bus_shelter',
          effects: {
            relationships: { yuna: 12, siwoo: 3 },
            flags: { survivedSpicy: true },
            memory: ['{{playerName}} ne bina dare Yu-na ka ultra-spicy challenge poora kiya.']
          }
        },
        {
          id: 'c3_mix_both',
          text: 'Dono ka ek-ek bite lekar dono ko khush karo',
          shortLabel: 'Dono ka bite lo',
          keywords: ['dono', 'bite', 'balance', 'khush'],
          next: 's4_rainy_bus_shelter',
          effects: {
            relationships: { siwoo: 6, yuna: 6 },
            memory: ['{{playerName}} ne dono ke khane ko aadar dekar smart balance banaya.']
          }
        }
      ]
    },
    {
      id: 's4_rainy_bus_shelter',
      title: 'Seoul Ki Barish Aur Ek Hi Chhatri',
      narration: [
        '*Shaam ko achanak Seoul ke aasmaan mein kale baadal ghir aate hain aur dhuandhaar baarish shuru ho jaati hai.*',
        '*Campus ke bus stop ke shelter mein tum khade ho. Tabhi baarish mein se Si-woo gili hokar aati hai, aur peeche se Yu-na apni leather jacket sar par dale bhaagti aati hai.*',
        '*Dono tumhare bagal mein aakar rukti hain. Thandi hawa aur baarish ki khushboo ke beech unki aahat bilkul kareeb hai.*',
        'Si-woo: "Mujhe laga sab chale gaye honge... kitni tez baarish hai."',
        'Yu-na: "Lagta hai K-Drama ka koi emotional scene chal raha hai. Par sach mein... tum dono ke sath yahan rukna bura nahi lag raha."'
      ],
      fallbackLines: [
        '*Baarish road ke neon signboards par chamak rahi hai.*',
        'Si-woo: "Aapko thand toh nahi lag rahi na?"'
      ],
      choices: [
        {
          id: 'c4_share_jacket_both',
          text: 'Apna trench coat khol kar dono ke kandhon par barabar dhalo',
          shortLabel: 'Coat dono par dhalo',
          keywords: ['coat', 'dono', 'barish', 'garam'],
          next: 's5_festival_duet_hook',
          effects: {
            relationships: { siwoo: 8, yuna: 8 },
            flags: { romanticCoatMove: true },
            memory: ['{{playerName}} ne baarish mein apna coat dono ladkiyon ke sath share kiya.']
          }
        },
        {
          id: 'c4_suggest_cafe_escape',
          text: '"Chalo samne wale 24-hour ramen cafe mein bhaagte hain!"',
          shortLabel: 'Ramen cafe bhaago',
          keywords: ['ramen', 'cafe', 'bhaago', 'barish'],
          next: 's5_festival_duet_hook',
          effects: {
            relationships: { siwoo: 7, yuna: 9 },
            memory: ['{{playerName}} ne baarish mein daudte hue ramen cafe ka mast plan banaya.']
          }
        }
      ]
    },
    {
      id: 's5_festival_duet_hook',
      title: 'Campus Festival Ka Aagaz Aur Future Hook',
      narration: [
        '*Barish dheemi ho rahi hai. Streetlights ki roshni mein Si-woo aur Yu-na dono tumhari taraf dekhti hain — unki ankhon mein ab sirf dosti nahi, balki ek aisi kashish hai jo kisi script mein nahi likhi thi.*',
        'Si-woo: "Agla hafta university festival hai {{playerName}}-ssi... kya aap mere sath volunteer stall sambhalenge?"',
        'Yu-na: "Hell no! Yeh mere band ke sath stage par duet perform karega!"',
        '*Dono tumhara haath pakadti hain. Ek taraf angel ki narm thandak, doosri taraf devil ki aag.*',
        '*Yeh kahani yahan khatam nahi hoti — festival ka stage, Seoul ke raaz, K-Drama twists aur in do anokhi ladkiyon ke dil jeetne ka safar abhi abhi shuru hua hai.*'
      ],
      fallbackLines: [
        '*Seoul ki hawa mein cherry blossoms ki mehak hai.*',
        '*Tum jante ho ki tumhara naya safar lazawab hone wala hai.*'
      ],
      choices: [
        {
          id: 'c5_promise_festival_both',
          text: 'Dono ko muskura kar bolo — "Main dono ke sath waqt bitaunga, deal!"',
          shortLabel: 'Dono se deal karo',
          keywords: ['deal', 'festival', 'dono', 'stage'],
          next: 's1_haneul_university_awakening',
          effects: {
            relationships: { siwoo: 5, yuna: 5 },
            memory: ['{{playerName}} ne festival mein dono ke sath barabar rehne ka wada kiya.']
          }
        },
        {
          id: 'c5_tease_both_leads',
          text: 'Mazaak karte hue bolo — "Lagta hai hero banne ke side effects bohot mehenge hain."',
          shortLabel: 'Hero ke side effects',
          keywords: ['hero', 'side effects', 'banter', 'mazak'],
          next: 's1_haneul_university_awakening',
          effects: {
            relationships: { siwoo: 6, yuna: 6 },
            memory: ['{{playerName}} ne sweet banter ke sath festival ki shuruaat ki.']
          }
        }
      ]
    }
  ]
};
