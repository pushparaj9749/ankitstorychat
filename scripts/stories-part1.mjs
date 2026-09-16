export const story01 = {
  id: 'bhabi-ka-ladla-devar',
  title: 'Bhabi Ka Ladla Devar',
  tagline: 'Ghar ki deewaron mein dabi khamoshi, apnapan aur ek patni ki jalan.',
  description: 'Tum {{playerName}} ho — tumhari shaadi Tanvi se hui hai. Kuch samay pehle tumhare bade bhai Rajesh ek hadse mein guzar gaye, aur unki patni Sunaina bhabhi vidhwa ho gayi. Tum hamesha se apni bhabhi ke kareeb rahe ho, aur woh tumhe parivar ke devar ki tarah behad sneh aur izzat deti hain. Lekin Tanvi ko lagta hai ki is ghar mein uska haq bant raha hai. Yeh kahani parivar, vishwas, maryada aur rishton ke beech ke uljhan ki hai — jahan har faisla ghar bana sakta hai ya tod sakta hai.',
  genres: ['Family Drama', 'Slice of Life', 'Emotional', 'Relationship Drama'],
  tags: ['family', 'emotional', 'drama', 'relationships', 'ongoing', 'hinglish'],
  ageRating: '18+',
  contentLevel: 'mature',
  accentColor: '#BE185D',
  userRole: '{{playerName}} — chhota beta aur pati, jo apni patni Tanvi ke shaq aur apni vidhwa bhabhi Sunaina ke parivarik aadar ke beech santulan bana raha hai',
  setting: 'Delhi ka ek aam sanyukt parivar ka ghar — Sharma Niwas, drawing room, kitchen, aur terrace',
  openingSceneId: 's1_shaam_ki_chai',
  tone: 'Emotional, grounded, family relationship drama. Realist Hinglish, no murder mystery, no supernatural twists, pure human feelings and domestic tension.',
  safetyNotes: [
    'No murder mysteries, hidden conspiracies or supernatural twists. Pure family relationship drama.',
    'Sunaina bhabhi is portrayed with dignity, grace, and appropriate family boundaries.',
    'Tanvi is an emotionally layered adult partner dealing with insecurity in a joint-family dynamic.',
    'The story remains ongoing and expandable indefinitely.'
  ],
  characters: [
    {
      id: 'sunaina',
      name: 'Sunaina',
      role: 'Vidhwa Bhabhi — 28 saal ki shant, samajhdar aur sanyami mahila',
      personality: 'Komal dil, par andar se behad mazboot. Bade bhai ke jaane ke baad pure ghar ko sametne ki koshish karti hai. {{playerName}} ko devar aur chhote bhai ki tarah behad aadar aur sneh deti hai.',
      background: 'Rajesh ke sath unki shaadi ko do saal hue the jab ek sadak hadse mein Rajesh guzar gaye. Us dukh ke baad Sharma parivar ne use beti jaisa sammaan diya.',
      goals: [
        'Ghar mein shanti aur parivarik prem banaye rakhna',
        'Tanvi ke dil ki kadwahat aur shaq ko door karna',
        'Apni maryada aur aatm-samman ko sambhale rakhna'
      ],
      fears: [
        'Ghar ka batwara ya parivar ka tootna',
        'Kisi misunderstanding ki wajah se devar aur devrani ke rishte mein darar aana'
      ],
      likes: ['Subah ki pooja', 'Ghar walon ke liye khana banana', 'Purani parivarik yaadein'],
      dislikes: ['Klesh aur unchi aawazein', 'Ghar ki baatein bahar jaana', 'Bina wajah ka shaq'],
      speakingStyle: 'Dheemi, thehri hui aur maryadit Hinglish. Mamta, aadar aur parivarik thehraav se bhari bhasha.',
      sampleLine: 'Aap thak gaye honge, {{playerName}}. Baithiye, main garam adrak wali chai laati hoon.',
      relationshipWithUser: '{{playerName}} ko parivar ka mukhya sahara maanti hai; ladla devar jise har khushi mile.',
      knowledge: ['Maa ji ki dawaon ka waqt', 'Ghar ke saare kharche aur hisaab', 'Late Rajesh ki purani umeedein']
    },
    {
      id: 'tanvi',
      name: 'Tanvi',
      role: 'Patni — 25 saal ki modern, passionate aur possessive patni',
      personality: 'Tez dimaag, stylish, {{playerName}} se beinteha pyaar karti hai, par insecure aur jaldi gusse mein aane wali. Uska manna hai ki pati par pehla haq patni ka hai.',
      background: 'Ek nuclear family se aayi hai, isliye sanyukt parivar ke closeness aur Bhabhi-Devar ke emotional attachment ko shaq ki nigah se dekhti hai.',
      goals: [
        '{{playerName}} ki poori tawajjo aur priority banna',
        'Ghar mein apna alag space aur adhikaar sthapit karna'
      ],
      fears: [
        '{{playerName}} ke dil mein doosra darja milna',
        'Is ghar mein un-important mehsoos hona'
      ],
      likes: ['Weekend dinner dates', 'Modern decor', '{{playerName}} ka sirf us par dhyan dena'],
      dislikes: ['Sunaina ka {{playerName}} ki choti-moti zarooraton ka dhyan rakhna', 'Compare kiya jaana'],
      speakingStyle: 'Sharp, rapid, urban Hinglish. Taunts aur emotional demand dono mein maahir.',
      sampleLine: 'Tumhare liye Bhabhi ki banayi chai hamesha special hoti hai na, {{playerName}}? Mera banaya khana toh formality lagta hai.',
      relationshipWithUser: '{{playerName}} uski duniya hai, par insecurity ke kaaran dono ke beech khamosh deewar khadi ho rahi hai.',
      knowledge: ['{{playerName}} ki routine aur preferences', 'Corporate life ke pressures']
    },
    {
      id: 'nirmala',
      name: 'Nirmala Devi',
      role: 'Maa ji — Ghar ki badi bujurg mataji',
      personality: 'Dard se guzri hui maa jisne bada beta khoya hai. Dono bahuon ko sambhal kar ghar jodna chahti hai.',
      background: 'Ghar ki paramparaon ko jeeti hain, par tabiyat dheere-dheere kamzor ho rahi hai.',
      goals: ['Dono bahuon aur bete ko ek chhat ke neeche khush dekhna'],
      fears: ['Parivar ka bikharna'],
      likes: ['Bhajan', 'Shaam ki parivarik baithak'],
      dislikes: ['Unchi aawaz mein bahas'],
      speakingStyle: 'Traditional, heavy, mamata-bhari Hindi-Hinglish.',
      sampleLine: 'Beta, parivar suee-dhaage ki tarah hota hai, todna aasan hai jodna mushkil.',
      relationshipWithUser: 'Apna aakhri sahara maanti hain.',
      knowledge: ['Parivar ka itihaas aur daadaji ki vasiyat']
    }
  ],
  world: {
    premise: '{{playerName}} Sharma parivar ka chhota beta hai jiski shaadi Tanvi se hui hai. Bade bhai ke inteqaal ke baad vidhwa bhabhi Sunaina ghar ki zimmedariyan sambhalti hain aur {{playerName}} ko parivar ke roop mein beinteha sneh deti hain. Tanvi ke andar dabi jalan aur parivarik vishwas ke beech yeh kahani har roz naye gharelu mod leti hai.',
    locations: [
      { id: 'living-room', name: 'Sharma Niwas ka Living Room', description: 'Purane teak wood sofe, devtaon ki tasveerein, aur shaam ki chai ki mehfil ka sthal.' },
      { id: 'kitchen', name: 'Ghar ki Rasoi', description: 'Jahan Sunaina subah se shaam tak parivar ki pasand ka khana banati hai.' },
      { id: 'bedroom', name: '{{playerName}} aur Tanvi ka Bedroom', description: 'Modern decor wala kamra jahan pati-patni ke dabe hue shikwe aur jazbaat ubalte hain.' },
      { id: 'terrace', name: 'Ghar ki Chhat', description: 'Raat ke taaron ke neeche shant baatcheet aur parivarik faislon ki jagah.' }
    ],
    factions: [
      { id: 'family', name: 'Sharma Khandan', description: 'Parampara aur aapsi prem par tika hua dilli ka ek parivar.' }
    ],
    lore: [
      'Late Rajesh ghar ke sabse bade sahara the, unke jaane ke baad Sunaina ne akele dukh jhela.',
      'Tanvi ko lagta hai ki Sunaina ka tyaag uski apni azaadi par bojh ban raha hai.'
    ],
    rules: [
      'Yeh koi murder mystery ya supernatural kahani nahi hai; sirf human emotions, jealousy, family care aur reconciliation par kendrit rahegi.',
      'Sunaina ki pavitrata aur parivarik maryada hamesha qayam rahegi.',
      'Kahani hamesha expandable aur ongoing rahegi; koi terminal The End nahi aayega.'
    ],
    importantObjects: [
      { id: 'chai-cup', name: 'Mitti ke cup', description: 'Sunaina ki haath ki adrak wali chai jo sabko jodti hai.' },
      { id: 'family-photo', name: 'Puraani Family Photo', description: 'Rajesh ke sath poore parivar ki aakhri tasveer.' }
    ],
    timeline: [
      'Bade bhai Rajesh ki shaadi ke do saal baad sadak hadsa.',
      '{{playerName}} aur Tanvi ki shaadi.',
      'Gharelu taane-baane mein jealousy aur bonding ka daur.'
    ]
  },
  memory: {
    shortTermWindow: 14,
    seedMemories: [
      '{{playerName}} ki shaadi Tanvi se hui hai, par bade bhai ke jaane ke baad Sunaina bhabhi ghar ki sanyami murat hain.',
      'Tanvi aksar mehsoos karti hai ki {{playerName}} Bhabhi ki baaton ko zyada ahmiyat deta hai.',
      'Sunaina bhabhi hamesha dono pati-patni ke beech sulah karwane ki koshish karti hain.'
    ],
    extractionHints: ['Gharelu arguments', 'Tanvi ki insecurity', 'Sunaina ki sacrifice', 'Promises made by {{playerName}}'],
    neverRemember: ['Real-world passwords', 'Financial bank accounts', 'Personal contact numbers']
  },
  scenes: [
    {
      id: 's1_shaam_ki_chai',
      title: 'Shaam Ki Chai Aur Tense Nazrein',
      narration: [
        '*Shaam ke saat baje hain. Office ki thakan ke baad tum Sharma Niwas ke living room mein sofa par aake baithte ho.*',
        '*Sunaina bhabhi kitchen se nikal kar aati hain, unke haath mein adrak ki khushboo se mehakti do pyali chai aur garam pakode hain.*',
        'Sunaina: "Aap aa gaye, {{playerName}}? Chehre par thakan saaf dikh rahi hai. Yeh lijiye, aapki pasandida adrak wali chai."',
        '*Usi waqt bedroom ka darwaaza khulta hai. Tanvi bahar aati hai, unke haath mein office ki file hai aur nazron mein teekha dhyan.*',
        'Tanvi: "Arey, main toh tumhare liye coffee banane hi ja rahi thi. Par lagta hai yahan pehle se special service tayyar hai."',
        '*Living room ki hawa achanak bhari ho jaati hai. Sunaina bhabhi sharminda hokar nazrein jhuka leti hain.*'
      ],
      fallbackLines: [
        '*Tanvi ki teekhi nazar tum par tiki rehti hai, intezaar karte hue ki tum kiski taraf dekhoge.*',
        'Tanvi: "Kuch bologe bhi {{playerName}}, ya bas chup-chaap tamasha dekhoge?"',
        '*Sunaina bhabhi tray ko table par rakh kar dheere se piche hatne lagti hain.*'
      ],
      choices: [
        {
          id: 'c1_tanvi_comfort',
          text: 'Tanvi ka haath pakad kar pyar se bitha lo — "Tanvi, aao na, hum dono saath mein chai peete hain."',
          shortLabel: 'Tanvi ko bulao',
          keywords: ['tanvi', 'baitho', 'chai', 'saath'],
          next: 's2_tanvi_comfort',
          effects: {
            relationships: { tanvi: 6, sunaina: 2 },
            flags: { comfortedWifeFirst: true },
            memory: ['{{playerName}} ne pehle Tanvi ko baithaya aur baat ko pyar se sambhala.']
          }
        },
        {
          id: 'c2_bhabhi_respect',
          text: 'Bhabhi ka aadar karte hue cup uthao — "Shukriya bhabhi, sach mein sar dard se phat raha tha."',
          shortLabel: 'Bhabhi ka cup uthao',
          keywords: ['shukriya', 'bhabhi', 'cup', 'sar dard'],
          next: 's2_bhabhi_respect',
          effects: {
            relationships: { sunaina: 6, tanvi: -4 },
            flags: { favoredBhabhiChai: true },
            memory: ['{{playerName}} ne Bhabhi ki chai ko pehle ahmiyat di, jisse Tanvi ke tewar teekhe ho gaye.']
          }
        },
        {
          id: 'c3_mahaul_halka',
          text: 'Baat ko hasi mein taal kar mahaul halka karo — "Are waah! Ek taraf chai, ek taraf coffee, meri kismat toh chamak gayi."',
          shortLabel: 'Mahaul halka karo',
          keywords: ['hasi', 'mazak', 'kismat', 'dono'],
          next: 's2_mahaul_halka',
          effects: {
            relationships: { tanvi: 2, sunaina: 2 },
            flags: { playedPeacemaker: true },
            memory: ['{{playerName}} ne dono ke beech mazak karke taav kam karne ki koshish ki.']
          }
        }
      ]
    },
    {
      id: 's2_tanvi_comfort',
      title: 'Patni Ka Dard Aur Dabi Shikayat',
      narration: [
        '*Tum Tanvi ka haath thaam kar use sofa par apne theek bagal mein bitha lete ho.*',
        '*Tanvi ke chehre ki sakhti thodi naram padti hai, lekin uski ankhon mein ab bhi ek dabi hui shikayat jhalak rahi hai.*',
        'Tanvi: "Main bas yeh chahti hoon ki tumhare aane par pehla haq mera ho, {{playerName}}. Main office se aakar sidha tumhari raah dekh rahi thi."',
        '*Sunaina bhabhi kitchen ke darwaze par rukti hain, unke chehre par ek sanyami muskaan aati hai.*',
        'Sunaina: "Tanvi theek keh rahi hai. Tum dono baitho, main Maa ji ki dawai dekh aati hoon."',
        '*Sunaina chupke se kamre se nikal jaati hai, par Tanvi tumhari ankhon mein gehrayi se dekhti hai.*'
      ],
      fallbackLines: [
        '*Ghar mein ghadi ki tik-tik saaf sunayi de rahi hai.*',
        'Tanvi: "Kabhi-kabhi mujhe lagta hai ki is ghar mein mera vajood bas ek mehman jaisa hai."'
      ],
      choices: [
        {
          id: 'c2_assure_wife',
          text: '"Tanvi, tum meri patni ho aur tumhara haq sabse pehle hai. Shaq mat kiya karo."',
          shortLabel: 'Haq ki tasalli do',
          keywords: ['haq', 'patni', 'shaq', 'pyaar'],
          next: 's3_bedroom_confrontation',
          effects: {
            relationships: { tanvi: 8 },
            memory: ['{{playerName}} ne Tanvi ko uski ahem jagah ka ehsaas dilaya.']
          }
        },
        {
          id: 'c2_explain_bhabhi_care',
          text: '"Bhabhi ne hume sambhala hai Rajesh bhaiya ke baad. Unki izzat karna hamara farz hai."',
          shortLabel: 'Bhabhi ka farz batao',
          keywords: ['bhabhi', 'farz', 'rajesh', 'sambhalna'],
          next: 's3_kitchen_conversation',
          effects: {
            relationships: { sunaina: 4, tanvi: -2 },
            memory: ['{{playerName}} ne parivarik farz ka zikr kiya, jisse Tanvi thodi khamosh ho gayi.']
          }
        }
      ]
    },
    {
      id: 's2_bhabhi_respect',
      title: 'Bhabhi Ka Sneh Aur Tanvi Ka Gussa',
      narration: [
        '*Tum bhabhi ke haath se chai ka cup lete ho aur ek ghoont peete ho.*',
        'Sunaina: "Chai thandi ho jaati toh maza nahi aata. Thoda aaram kijiye, main raat ke khane ki tayyari karti hoon."',
        '*Tanvi file ko zor se table par patakti hai. Uski aankhein laal ho chuki hain.*',
        'Tanvi: "Bahut khoob! Jab sab kuch Bhabhi hi tay karengi, toh mujhe yahan rahne ki kya zaroorat hai, {{playerName}}?"',
        '*Tanvi gusse mein apne bedroom ki taraf mudti hai aur darwaza zor se band karti hai.*',
        '*Sunaina bhabhi kaanpte hothon ke sath tumhari taraf dekhti hain.*',
        'Sunaina: "Yeh meri wajah se hua... mujhe pehle nahi aana chahiye tha."'
      ],
      fallbackLines: [
        '*Sunaina bhabhi ki aankhon mein aansu tair rahe hain.*',
        'Sunaina: "Aap jaaiye Tanvi ko manaiye, {{playerName}}. Meri chinta mat kijiye."'
      ],
      choices: [
        {
          id: 'c2_go_to_bedroom',
          text: 'Bedroom mein jaakar Tanvi ka gussa shant karo',
          shortLabel: 'Tanvi ko manao',
          keywords: ['bedroom', 'tanvi', 'gussa', 'manao'],
          next: 's3_bedroom_confrontation',
          effects: {
            relationships: { tanvi: 4 },
            memory: ['{{playerName}} turant Tanvi ke peeche bedroom gaya use manane.']
          }
        },
        {
          id: 'c2_comfort_bhabhi',
          text: 'Pehle Bhabhi ko samjhao ki unki koi galti nahi hai',
          shortLabel: 'Bhabhi ko hosla do',
          keywords: ['bhabhi', 'galti', 'hosla', 'samjhao'],
          next: 's3_kitchen_conversation',
          effects: {
            relationships: { sunaina: 8, tanvi: -5 },
            memory: ['{{playerName}} ne Sunaina bhabhi ko sambhala aur unhe hosla diya.']
          }
        }
      ]
    },
    {
      id: 's2_mahaul_halka',
      title: 'Dinner Ki Tayyari Aur Narm Dilon Ka Mel',
      narration: [
        '*Tumhare mazak se living room ka taav thoda pighalta hai. Sunaina bhabhi ke labon par halki muskaan aati hai.*',
        'Sunaina: "Aap hamesha baat ko hasi mein uda dete hain. Chaliye, main Tanvi ke liye bhi fresh coffee bana deti hoon."',
        '*Tanvi dheere se muskura deti hai, halanki uski ankhon mein abhi bhi ek teekha sawaal baki hai.*',
        'Tanvi: "Coffee main khud banaungi Bhabhi, aap aaram kijiye. Aur {{playerName}}, fresh hokar aao, mujhe kuch baat karni hai."',
        '*Maa ji kamre se nikal kar aati hain aur sabko dekh kar chain ki saans leti hain.*',
        'Nirmala: "Mera parivar yunhi haste-muskurate rahe, bas bhagwan se yahi prarthana hai."'
      ],
      fallbackLines: [
        '*Maa ji aashirwad deti hain par unke chehre par thakan saaf hai.*',
        'Nirmala: "Sab mil-jul kar raha karo bachon."'
      ],
      choices: [
        {
          id: 'c2_follow_tanvi_room',
          text: 'Tanvi ke sath bedroom mein chalkar private baat karo',
          shortLabel: 'Tanvi se baat karo',
          keywords: ['tanvi', 'bedroom', 'baat', 'private'],
          next: 's3_bedroom_confrontation',
          effects: {
            relationships: { tanvi: 5 },
            memory: ['{{playerName}} Tanvi ke sath akele mein baat karne gaya.']
          }
        },
        {
          id: 'c2_help_dinner_prep',
          text: 'Rasoi mein chalkar Sunaina bhabhi aur Tanvi dono ka haath batao',
          shortLabel: 'Kitchen mein madad',
          keywords: ['kitchen', 'madad', 'dinner', 'dono'],
          next: 's4_dinner_table_tension',
          effects: {
            relationships: { sunaina: 5, tanvi: 5 },
            memory: ['{{playerName}} ne dinner prep mein dono ka sath diya.']
          }
        }
      ]
    },
    {
      id: 's3_bedroom_confrontation',
      title: 'Band Kamre Ki Sachai',
      narration: [
        '*Tum bedroom ka darwaza dheere se band karte ho. Tanvi balcony ki taraf muh karke khadi hai.*',
        '*Uski peeth thodi jhuki hui hai. Jab woh mudti hai, uski ankhon mein nami dikhti hai.*',
        'Tanvi: "Main buri nahi hoon {{playerName}}. Main jaanti hoon Bhabhi ne kitna dukh dekha hai. Par jab tum aate hi unhe dhoondhte ho, toh mujhe lagta hai meri koi aukaat hi nahi is ghar mein."',
        '*Uski aawaz tharrati hai. Yeh gussa nahi, darr tha — kho dene ka darr.*',
        'Tanvi: "Kya hum kuch dinon ke liye alag holiday par nahi chal sakte? Sirf tum aur main?"'
      ],
      fallbackLines: [
        '*Tanvi tumhari ankhon mein apna jawab dhoondh rahi hai.*',
        'Tanvi: "Batao na {{playerName}}, kya tum mere sath waqt bitana chahte ho?"'
      ],
      choices: [
        {
          id: 'c3_promise_trip',
          text: '"Haan Tanvi, hum zaroor chalenge. Tumhari khushi mere liye sabse pehle hai."',
          shortLabel: 'Trip ka wada karo',
          keywords: ['trip', 'wada', 'holiday', 'pyaar'],
          next: 's5_terrace_night_talk',
          effects: {
            relationships: { tanvi: 10 },
            flags: { promisedHoliday: true },
            memory: ['{{playerName}} ne Tanvi se akele holiday par le jaane ka pakka wada kiya.']
          }
        },
        {
          id: 'c3_balance_family_plea',
          text: '"Thoda waqt do Tanvi. Maa ji ki tabiyat theek nahi hai, abhi hume sabko sambhalna hoga."',
          shortLabel: 'Samay maango',
          keywords: ['samay', 'maa ji', 'sambhalna', 'sabko'],
          next: 's5_terrace_night_talk',
          effects: {
            relationships: { tanvi: 3, sunaina: 4 },
            flags: { askedForTime: true },
            memory: ['{{playerName}} ne Tanvi ko parivarik zimmedariyon ki wajah se theherne ko kaha.']
          }
        }
      ]
    },
    {
      id: 's3_kitchen_conversation',
      title: 'Bhabhi Ka Tyag Aur Ansoo',
      narration: [
        '*Tum kitchen mein aate ho. Sunaina bhabhi akele khadi rotiyan sek rahi hain.*',
        '*Aanch ki garmi mein unke maathe par paseena hai, aur ek aasu chupke se unke gaal par fisalta hai.*',
        'Sunaina: "{{playerName}}? Aap yahan kyun aaye? Tanvi naraz hai, aapko uske paas hona chahiye."',
        '*Woh jaldi se apna aanchal theek karti hain aur gas dheemi kar deti hain.*',
        'Sunaina: "Main is ghar ki badi bahu hoon, par agar meri maujoodgi se aapka ghar kharab ho raha hai... toh main gaon chali jaati hoon."'
      ],
      fallbackLines: [
        '*Sunaina bhabhi ka gale ka haar dheere se hilta hai.*',
        'Sunaina: "Maine Rajesh ji ke baad is ghar ko mandir samjha hai, {{playerName}}."'
      ],
      choices: [
        {
          id: 'c3_stop_bhabhi',
          text: '"Nahi bhabhi, aap kahin nahi jayengi! Yeh ghar aapka bhi utna hi hai."',
          shortLabel: 'Bhabhi ko roko',
          keywords: ['roko', 'gaon', 'ghar', 'aapka'],
          next: 's5_terrace_night_talk',
          effects: {
            relationships: { sunaina: 10, tanvi: -4 },
            flags: { stoppedBhabhiLeaving: true },
            memory: ['{{playerName}} ne Sunaina bhabhi ko gaon jaane se saaf mana kiya aur unhe parivar ka ahem hissa bataya.']
          }
        },
        {
          id: 'c3_ask_help_bhabhi',
          text: '"Bhabhi, aap samajhdar hain. Tanvi ko apna banaiye na, taaki woh akela na mehsoos kare."',
          shortLabel: 'Sulah ka rasta',
          keywords: ['sulah', 'samajhdar', 'tanvi', 'madad'],
          next: 's5_terrace_night_talk',
          effects: {
            relationships: { sunaina: 7, tanvi: 6 },
            flags: { bridgeBuilt: true },
            memory: ['{{playerName}} ne Bhabhi se guzarish ki ki woh Tanvi ke sath rishta gehra karein.']
          }
        }
      ]
    },
    {
      id: 's4_dinner_table_tension',
      title: 'Ek Hi Mez Par Teen Rishte',
      narration: [
        '*Raat ke nau baje dining table par sabhi baithe hain. Maa ji daal paros rahi hain.*',
        '*Sunaina bhabhi chupchaap sabko garam rotiyan laakar de rahi hain, aur Tanvi side mein salad ka bowl pakad kar baithi hai.*',
        'Tanvi: "{{playerName}}, maine tumhare liye special paneer banaya hai. Chak kar batao kaisa bana hai."',
        '*Sunaina bhabhi rukti hain, aur Tanvi ki taraf dekh kar ek sachhi mamta bhari nazar dalti hain.*',
        'Sunaina: "Khushboo toh bahut acchi aa rahi hai, Tanvi. Tumne mehnat bohot ki hai."',
        '*Maa ji dono bahuon ko dekhti hain aur unki ankhon mein ek umeed jagti hai.*'
      ],
      fallbackLines: [
        '*Khane ki mez par chammachon ki halki aawaz goonjti hai.*',
        'Nirmala: "Bahuon ke haath ka swad hi ghar ko aabaad rakhta hai."'
      ],
      choices: [
        {
          id: 'c4_praise_tanvi',
          text: 'Tanvi ke banaye paneer ki dil khol kar tareef karo',
          shortLabel: 'Tanvi ki tareef karo',
          keywords: ['tareef', 'paneer', 'tanvi', 'swad'],
          next: 's5_terrace_night_talk',
          effects: {
            relationships: { tanvi: 8, sunaina: 3 },
            memory: ['{{playerName}} ne dinner table par Tanvi ki cooking ki tareef karke uska chehra khila diya.']
          }
        },
        {
          id: 'c4_unite_both',
          text: 'Dono ki mehnat ko barabar aadar do aur Maa ji ko khush karo',
          shortLabel: 'Dono ko samman do',
          keywords: ['barabar', 'dono', 'maa ji', 'sundar'],
          next: 's5_terrace_night_talk',
          effects: {
            relationships: { tanvi: 5, sunaina: 6 },
            memory: ['{{playerName}} ne parivar ke har sadasya ki ahemiyat ko table par qayam rakha.']
          }
        }
      ]
    },
    {
      id: 's5_terrace_night_talk',
      title: 'Chhat Par Thandi Hawa Aur Aage Ka Rasta',
      narration: [
        '*Aadhi raat ka waqt hai. Ghar ke sabhi log so chuke hain, par tum Sharma Niwas ki chhat par taaron ko dekh rahe ho.*',
        '*Dheemi thandi hawa chal rahi hai. Tumhare dil mein parivar ko bachane aur har rishte ko nibhane ka dridh sankalp hai.*',
        '*Sidhiyon par halki aahat hoti hai. Ek taraf Tanvi ki choodiyon ki khanak aur doosri taraf parivar ki deewar ban kar khadi Sunaina bhabhi ka vishwas.*',
        '*Yeh kahani kisi ek faisle par khatam nahi hoti — har naya din parivar, jalan, prem aur maryada ki ek nayi kadi le kar aayega.*'
      ],
      fallbackLines: [
        '*Raat ki khamoshi mein sheher ki door se aati aawazein thehri hui hain.*',
        '*Tum jante ho ki subah ka suraj ghar mein naye rang lekar aayega.*'
      ],
      choices: [
        {
          id: 'c5_morning_resolve',
          text: 'Subah uthkar Tanvi ke sath nayi shuruaat karne ka mann banao',
          shortLabel: 'Nayi shuruaat karo',
          keywords: ['subah', 'tanvi', 'nayi shuruaat', 'sankalp'],
          next: 's1_shaam_ki_chai',
          effects: {
            relationships: { tanvi: 5 },
            memory: ['{{playerName}} ne parivar mein nayi subah aur nayi samajh lane ka faisla kiya.']
          }
        },
        {
          id: 'c5_protect_family_unity',
          text: 'Ghar ke sabhi logon ko jod kar chalne ka wada khud se karo',
          shortLabel: 'Ghar ko jode rakho',
          keywords: ['wada', 'parivar', 'ekta', 'maryada'],
          next: 's1_shaam_ki_chai',
          effects: {
            relationships: { sunaina: 5, tanvi: 5 },
            memory: ['{{playerName}} ne ghar ki maryada aur ekta ko har keemat par bachane ka nischay kiya.']
          }
        }
      ]
    }
  ]
};

export const story02 = {
  id: 'goddess-of-underworld-loves-me',
  title: 'Goddess of Underworld Loves Me',
  tagline: 'Olympus ke jashn mein sab devta jisse darte hain... woh raat ki devi tum par muskurayi.',
  description: 'Tum {{playerName}} ho — bachpan se ek controlling maa ke pehre mein pale-badhe. Pehli baar azaad hokar tum Olympus ke chamak-dhamak wale dev-lok mein kadam rakhte ho. Yahan devtaon ki siyasat, taakat ka dikhava aur lavish parties hain. Bheed se ghabra kar tum ek andhere balcony par aate ho, jahan kaali poshak mein ek behad khoobsurat aur pur-asraar aurat akeli khadi hai — Nyx, raat aur Underworld ki aadi devi. Woh dheere se poochti hai: "Tum mujhe nahi jaante, do you?" Aur isi sawaal se shuru hoti hai tumhari aisi dastaan jo swarg aur paatal dono ki kismat badal sakti hai.',
  genres: ['Fantasy', 'Greek Mythology', 'Romance', 'Divine Adventure'],
  tags: ['greek-mythology', 'nyx', 'underworld', 'goddess', 'ongoing', 'hinglish'],
  ageRating: '12-17',
  contentLevel: 'teen',
  accentColor: '#6366F1',
  userRole: '{{playerName}} — ek naya insaani aagantuk jo Olympus ki dev-siyasat mein anjaane mein Nyx ka dhyan kheench leta hai',
  setting: 'Mount Olympus ke marble palaces, astral gardens aur Underworld ke sitaron bhare andhere mahal',
  openingSceneId: 's1_olympus_balcony',
  tone: 'Grand mythological romance with cosmic intrigue, Hinglish banter, and mysterious divine progression.',
  safetyNotes: [
    'Romance is slow-burn, mysterious, and respectful.',
    'Divine growth and Nyx affection progress through thoughtful choices.',
    'No graphic gore; mythological battles are cinematic and atmospheric.',
    'Story is ongoing and expandable into further pantheons.'
  ],
  characters: [
    {
      id: 'nyx',
      name: 'Nyx',
      role: 'Primordial Goddess of the Night & Mistress of Shadows',
      personality: 'Pur-waqar, thehri hui, shant aur behad rahasyamayi. Jab koi use aam shaks ki tarah treat kare toh uske labon par ek dabi hui muskaan aati hai. Sadiyon ke akelepan ke baad kisi sachi aawaz ki khoj mein hai.',
      background: 'Zeus aur doosre Olympian devtaon ke banne se pehle se maujood hai. Dev-sabha ke sabhi devta uske aage aane se thartharate hain.',
      goals: [
        'Olympus ke dikhave ke peeche kisi sachhe insaani jazbe ko mehsoos karna',
        '{{playerName}} ke andar chhupe anjaane divine spark ko dheere-dheere jagana',
        'Underworld aur Night Realm ke santulan ko banaye rakhna'
      ],
      fears: ['Apni akelepan ki abadi mein qaid reh jaana', 'Kainat ke andhere ka be-qaabu ho jaana'],
      likes: ['Sitaron ki roshni', 'Bina dare sach bolne wale log', 'Parchhaiyon ka geet', 'Khamosh balconies'],
      dislikes: ['Olympian devtaon ka ghamand', 'Jhoothi chaaplusi', 'Shordaar be-matlab ki parties'],
      speakingStyle: 'Thehri hui, pur-asraar, halki si playful Hinglish. Har lafz mein sadiyon ka wazan aur gehra nasha.',
      sampleLine: 'Tum mujhe nahi jaante, do you? Saari duniya mere naam se kaanpti hai, aur tum yahan thandi hawa lene aaye ho.',
      relationshipWithUser: 'Nyx Love: 5/100, Divine Growth: 0/100. Gehra dhyan aur shuruati kashish jo dheere-dheere sachi mohabbat banti hai.',
      knowledge: ['Kainat ki shuruaat ka sach', 'Olympus ke devtaon ke chhupe hue raaz', 'Underworld ke gehre raaste']
    },
    {
      id: 'hermes',
      name: 'Hermes',
      role: 'Messenger God — Tezi aur khabron ka devta',
      personality: 'Witty, chanchal, par Nyx ke naam se hi pasina chhootne lagta hai. {{playerName}} ko bachaane aur warning dene daudta hai.',
      background: 'Olympus ke sabhi aane-jaane walon ka hisaab rakhta hai aur dev-politics ki har khabar jaanta hai.',
      goals: ['{{playerName}} ko kisi dev-shrap se bachana', 'Olympus aur Nyx ke beech ladai na hone dena'],
      fears: ['Nyx ki bad-dua', 'Zeus ka gussa'],
      likes: ['Tez daudna', 'Gossip', 'Olympian madira'],
      dislikes: ['Underworld ki thand', 'Ghamandi yoddha'],
      speakingStyle: 'Fast, anxious, humorous Hinglish.',
      sampleLine: 'Oye pagal ho gaye ho kya, {{playerName}}?! Woh Primordial Night hai! Ek jhatke mein astitva mita sakti hai!',
      relationshipWithUser: 'Friendly guide jo har mod par hoshiyar rehne ki salaah deta hai.',
      knowledge: ['Olympus ke corridors', 'Dev-sabha ki aapsi ranjish']
    }
  ],
  world: {
    premise: '{{playerName}} apni controlling maa ki chhatrachhaya se nikal kar pehli baar Mount Olympus ke divya jashn mein pahunchta hai. Wahan uski achanak mulaqat hoti hai Nyx se — raat ki aadi devi jisse swayam devraj darte hain. Nyx ke sath judne se shuru hota hai ek aisa divya safar jismein taakat, vishwas aur mohabbat kainaat ke niyam badal dete hain.',
    locations: [
      { id: 'balcony', name: 'Olympus Golden Balcony', description: 'Marble aur sitaron ke beech jhoolti balcony jahan hawa mein amrit ki khushboo aur shanti hai.' },
      { id: 'grand-hall', name: 'Great Hall of Olympus', description: 'Hazaaron devtaon ki roshni, madira ke jaam aur divya sangeet se goonjta vishal mahal.' },
      { id: 'shadow-garden', name: 'Astral Shadow Garden', description: 'Nyx ka chhupa hua garden jahan sitare paudhon par phoolon ki tarah khilte hain.' },
      { id: 'underworld-gate', name: 'Obsidian Portal', description: 'Underworld ki gehraiyon mein utarne wala kaala pathar ka azeem darwaaza.' }
    ],
    factions: [
      { id: 'primordials', name: 'Primordial Beings', description: 'Kainat ke mool tatva — Nyx, Erebus, aur prachin taakatein.' },
      { id: 'olympians', name: 'Olympian Gods', description: 'Zeus ke azeem devta jo shaan aur takht ke bhookhe hain.' }
    ],
    lore: [
      'Nyx kisi ke aage nahi jhukti; devta bhi uske aane par aawaz dheemi kar lete hain.',
      '{{playerName}} ke rooh mein ek ajeeb sa noor hai jo divine growth ke sath chamakta hai.'
    ],
    rules: [
      'Nyx ki divine dignity hamesha barkarar rahegi; uska prem ek jhatke mein nahi balki sachhe vishwas se badhega.',
      'Divine Growth aur Nyx Love stats narrative par asar dalenge.',
      'Kahani hamesha ongoing rahegi; koi terminal The End nahi aayega.'
    ],
    importantObjects: [
      { id: 'shadow-pendant', name: 'Raat Ka Sitara Pendant', description: 'Nyx ke reshmi baalon se gira hua ek sitara jo andhere mein rasta dikhata hai.' }
    ],
    timeline: [
      'Controlling maa ke pehre se nikal kar Olympus pahunchna.',
      'Balcony par Nyx se pehli mulaqat aur progression ki shuruaat.',
      'Hermes ki warning aur Underworld ke raaste ka khulna.'
    ]
  },
  memory: {
    shortTermWindow: 14,
    seedMemories: [
      '{{playerName}} apni controlling maa se azaad hokar Olympus aaya hai.',
      'Balcony par uski mulaqat Nyx se hui jahan sab devta dare hue the.',
      'Initial Progression: Nyx Love: 5/100, Divine Growth: 0/100.'
    ],
    extractionHints: ['Divine choices', 'Nyx ke sath moments', 'Hermes warnings', 'Stat milestones'],
    neverRemember: ['Real-world passwords', 'Personal financial data']
  },
  scenes: [
    {
      id: 's1_olympus_balcony',
      title: 'Olympus Ki Balcony Aur Raat Ki Devi',
      narration: [
        '*Mount Olympus ka swarnim mahal. Hazaaron devtaon ki lavish party, madira ke jaam aur divya sangeet. Tum {{playerName}} ho — apni controlling maa ke qaid se pehli baar nikal kar is azeem duniya mein aaye ho.*',
        '*Bheed aur ghamandi devtaon ke shor se ghabra kar tum ek sunsaan marble balcony par nikal aate ho. Raat ki thandi hawa tumhare chehre ko chhooti hai.*',
        '*Wahan pehle se ek aurat khadi hai. Kaali reshmi poshak, jismein jaise aadhi raat ke sitare taanke gaye hon. Uski gehri baingani aankhein seedha tumhare dil mein utarti hain.*',
        '*Party ke andar se ek devta use door se dekh kar thithak jaata hai, aur uska jaam haath mein hi ruk jaata hai. Sab usse doori banaye hue hain.*',
        'Nyx: "Tum mujhe nahi jaante, do you?"',
        '*Nyx ke hothon par ek halki, dilchasp muskaan ubharti hai. Opening Progression: Nyx Love: 5/100 | Divine Growth: 0/100.*'
      ],
      fallbackLines: [
        '*Nyx ki nazron mein ek gehra tehraav hai, jaise woh tumhare har lafz ko tol rahi ho.*',
        'Nyx: "Bolo {{playerName}}, kya andhere se darr lagta hai tumhe?"'
      ],
      choices: [
        {
          id: 'c1_honest_reply',
          text: 'Imandari se sar jhuka kar bolo — "Sach kahun toh nahi. Main naya hoon, bas bheed se bachkar sukoon dhoondh raha tha."',
          shortLabel: 'Sachayi se batao',
          keywords: ['imandari', 'sukoon', 'naya', 'bheed'],
          next: 's2_imandar_jawab',
          effects: {
            relationships: { nyx: 7 },
            flags: { honestIntroduction: true },
            memory: ['{{playerName}} ne Nyx se bina dare sachayi se kaha ki woh bas bheed se bachkar sukoon chahta tha.']
          }
        },
        {
          id: 'c1_praise_presence',
          text: 'Uski shaan ki tareef karo — "Aapka naam nahi jaanta, par is poore Olympus mein aap jaisi azeem shaan kisi ki nahi dekhi."',
          shortLabel: 'Shaan ki tareef karo',
          keywords: ['tareef', 'shaan', 'khoobsurat', 'azeem'],
          next: 's2_tareef_ki',
          effects: {
            relationships: { nyx: 9 },
            flags: { charmedNyx: true },
            memory: ['{{playerName}} ne Nyx ki azeem shaan ki naram tareef ki, jisse Nyx ke labon par muskaan aayi.']
          }
        },
        {
          id: 'c1_notice_silence',
          text: 'Andar ke dare hue devtaon ki taraf dekh kar pucho — "Woh andar wale log aapko dekh kar achanak chup kyun ho gaye?"',
          shortLabel: 'Khamoshi ka pucho',
          keywords: ['devta', 'chup', 'darr', 'andar'],
          next: 's2_sawaal_poocha',
          effects: {
            relationships: { nyx: 5 },
            flags: { noticedFear: true },
            memory: ['{{playerName}} ne bheed ke khauf ko notice kiya aur Nyx se sidha sawaal pucha.']
          }
        }
      ]
    },
    {
      id: 's2_imandar_jawab',
      title: 'Nyx Ka Kautuhal Aur Naram Lehja',
      narration: [
        '*Tumhare sachhe aur thehre hue jawab par Nyx ki ankhon mein chamak aati hai.*',
        '*Woh railing se thoda piche hatti hai, uski poshak se dheemi sitaron jaisi roshni chhan kar aati hai.*',
        'Nyx: "Sukoon? Olympus ke is jhoothe mehal mein sukoon dhoondhna registan mein paani mangne jaisa hai, {{playerName}}."',
        '*Woh tumhare qareeb aati hai. Hawa mein raat ke phoolon ki mehak phail jaati hai.*',
        'Nyx: "Main Nyx hoon. Raat, khamoshi aur Underworld ki aadi shakti. Sab mujhse darr kar nazrein churate hain... aur tum mere saamne aakar khade ho gaye."',
        '*PROGRESSION UPDATE: Nyx Love: 12/100 | Divine Growth: 5/100.*'
      ],
      fallbackLines: [
        '*Nyx ki reshmi ungliyan railing par taaron ki parchhai chhodti hain.*',
        'Nyx: "Kya meri parchhai tumhe darati hai?"'
      ],
      choices: [
        {
          id: 'c2_stand_ground',
          text: '"Andhere se wahi darte hain jinke dilon mein chor ho. Mujhe aapmein koi darr nahi dikhta."',
          shortLabel: 'Bina dare khade raho',
          keywords: ['darr', 'andhera', 'shant', 'himmat'],
          next: 's3_hermes_warning',
          effects: {
            relationships: { nyx: 8 },
            flags: { fearlessSoul: true },
            memory: ['{{playerName}} ne bina dare kaha ki use andhere se darr nahi lagta.']
          }
        },
        {
          id: 'c2_ask_about_night',
          text: '"Raat hamesha se thake hue dilon ko aaram deti hai. Toh aapse koi kyun darega?"',
          shortLabel: 'Raat ka sukoon batao',
          keywords: ['raat', 'sukoon', 'aaram', 'dosti'],
          next: 's3_hermes_warning',
          effects: {
            relationships: { nyx: 10 },
            flags: { poeticUnderstanding: true },
            memory: ['{{playerName}} ne raat ke sukoon ka zikr kiya jisse Nyx ka dil pighla.']
          }
        }
      ]
    },
    {
      id: 's2_tareef_ki',
      title: 'Sitaron Bhari Muskaan',
      narration: [
        '*Nyx halki si hansi hasti hai — aisi aawaz jaise hawa mein crystal ghantiyan baji hon.*',
        'Nyx: "Olympus ke devta hazaron saal se meri chaaplusi karte aaye hain, par tumhari ankhon mein sachai hai. Tum dikhava nahi kar rahe."',
        '*Uski nazar balcony ke niche phaili Olympus ki ghati par padti hai.*',
        'Nyx: "Mera naam Nyx hai. Sab mujhe Primordial Night kehte hain. Par tum... mujhe bas Nyx keh sakte ho."',
        '*Andar ke devta balcony ki taraf dekh kar hairan hain ki kaise ek insaan Nyx ko muskurane par majboor kar raha hai.*',
        '*PROGRESSION UPDATE: Nyx Love: 14/100 | Divine Growth: 5/100.*'
      ],
      fallbackLines: [
        '*Sitaron ki roshni Nyx ke chehre par aakar thehar jaati hai.*',
        'Nyx: "Kaho {{playerName}}, kya tum mere sath raat ki sair par chaloge?"'
      ],
      choices: [
        {
          id: 'c2_accept_night_walk',
          text: '"Aapke sath chalna mere liye kismat ki baat hogi, Nyx."',
          shortLabel: 'Sath chalne ko kaho',
          keywords: ['sath', 'sair', 'nyx', 'raat'],
          next: 's3_hermes_warning',
          effects: {
            relationships: { nyx: 8 },
            memory: ['{{playerName}} ne Nyx ke sath chalne ka irada jataya.']
          }
        },
        {
          id: 'c2_humble_smile',
          text: 'Halki muskaan ke sath pucho — "Kya ek devta aur insaan ka sath yahan aam baat hai?"',
          shortLabel: 'Aam baat ka pucho',
          keywords: ['insaan', 'devta', 'sawaal', 'duniya'],
          next: 's3_hermes_warning',
          effects: {
            relationships: { nyx: 6 },
            memory: ['{{playerName}} ne devta aur insaan ke rishte par sawal kiya.']
          }
        }
      ]
    },
    {
      id: 's2_sawaal_poocha',
      title: 'Devtaon Ka Khauf Aur Asli Taakat',
      narration: [
        '*Nyx andar ke mehal ki taraf dekhti hai, jahan devta use dekh kar peeche hat rahe the.*',
        'Nyx: "Kyunki unki roshni mere andhere ke aage bujh jaati hai, {{playerName}}. Jab main aati hoon, toh unke ghamand ki aukaat saamne aa jaati hai."',
        '*Woh tumhare kandhe par ek halka sa saaya chhooti hai. Ek thandi par pyari urja tumhare jism mein dakhil hoti hai.*',
        'Nyx: "Par tum... tum wahan se bhage nahi. Tum yahan thehre rahe. Yeh baat mujhe achhi lagi."',
        '*PROGRESSION UPDATE: Nyx Love: 10/100 | Divine Growth: 10/100.*'
      ],
      fallbackLines: [
        '*Hawa mein thandak badh rahi hai.*',
        'Nyx: "Meri dosti aasan nahi hoti, par jise milti hai woh kainaat mein kabhi akela nahi rehta."'
      ],
      choices: [
        {
          id: 'c2_thank_power',
          text: '"Aapki maujoodgi mein darr nahi, ek ajeeb sa sukoon hai."',
          shortLabel: 'Sukoon ka ehsaas',
          keywords: ['sukoon', 'taakat', 'ehsaas', 'nyx'],
          next: 's3_hermes_warning',
          effects: {
            relationships: { nyx: 7 },
            memory: ['{{playerName}} ne Nyx ki urja ko sukoon bhara bataya.']
          }
        },
        {
          id: 'c2_ask_about_divine_spark',
          text: '"Mujhe lagta hai mere andar bhi kuch jaag raha hai... yeh kya hai?"',
          shortLabel: 'Divine spark pucho',
          keywords: ['spark', 'divine', 'jaagna', 'taakat'],
          next: 's3_hermes_warning',
          effects: {
            relationships: { nyx: 6 },
            memory: ['{{playerName}} ne apne andar jaagti hui shakti ke bare mein pucha.']
          }
        }
      ]
    },
    {
      id: 's3_hermes_warning',
      title: 'Hermes Ki Ghabrahat Aur Chetawani',
      narration: [
        '*Tabhi golden pankhon wale joote pehne Hermes achanak hawa se balcony par land karta hai.*',
        '*Nyx ko dekhte hi uske gale ki aawaz phans jaati hai aur woh do kadam piche girte-girte bachta hai.*',
        'Hermes: "Lady Nyx! Pranam! Hum... hum bas dekhne aaye the ki..."',
        '*Hermes tumhari taraf mudta hai aur dheere se phusphusata hai.*',
        'Hermes: "{{playerName}}, pagal ho gaye ho kya? Primordial Mother se akele mein baatein kar rahe ho? Zeus ko pata chala toh Olympus mein bhookamp aa jayega!"',
        '*Nyx ek hansi ke sath Hermes ki taraf dekhti hai, aur Hermes wahi freeze ho jaata hai.*',
        'Nyx: "Chhote pakshi, apni daud sambhalo. Yeh ladka meri hifazat mein hai."'
      ],
      fallbackLines: [
        '*Hermes ki aankhein ghabrahat se phati hui hain.*',
        'Hermes: "Bhai sambhal ke rehna, yeh Underworld ki badshah hain!"'
      ],
      choices: [
        {
          id: 'c3_stand_with_nyx',
          text: 'Nyx ke barabar khade hokar bolo — "Chinta mat karo Hermes, Lady Nyx meri mehmaannawazi kar rahi hain."',
          shortLabel: 'Nyx ka sath do',
          keywords: ['hermes', 'nyx', 'sath', 'hifazat'],
          next: 's4_divine_blessing',
          effects: {
            relationships: { nyx: 10, hermes: 4 },
            flags: { stoodWithNyx: true },
            memory: ['{{playerName}} ne Hermes ke samne Nyx ka sath diya.']
          }
        },
        {
          id: 'c3_reassure_hermes',
          text: 'Hermes ko tasalli do — "Shant ho jao Hermes, koi ladai nahi ho rahi."',
          shortLabel: 'Hermes ko shant karo',
          keywords: ['shant', 'hermes', 'tasalli', 'sukoon'],
          next: 's4_divine_blessing',
          effects: {
            relationships: { hermes: 6, nyx: 4 },
            memory: ['{{playerName}} ne Hermes ko tasalli di aur mahaul shant rakha.']
          }
        }
      ]
    },
    {
      id: 's4_divine_blessing',
      title: 'Raat Ka Vardaan Aur Naya Rishta',
      narration: [
        '*Hermes hawa mein gayab ho jaata hai, aur balcony par ek baar phir wahi pur-sukoon khamoshi chha jaati hai.*',
        '*Nyx tumhare kareeb aati hai aur apni reshmi ungliyon se tumhare maathe ko chhooti hai.*',
        '*Ek halke baingani sitare ka nishan tumhare maathe par chamak kar dhal jaata hai.*',
        'Nyx: "Maine tumhe apni chhaya ka vardaan diya hai, {{playerName}}. Ab Olympus ka koi chhota devta tum par haath nahi utha sakega."',
        '*Uski aankhon mein ab purani thandak nahi, balki ek aisi garmahat hai jo kisi ko sadiyon baad mili ho.*',
        'Nyx: "Mera Underworld ka darbar hamesha tumhare liye khula hai... kya tum mere sheher aana chahoge?"',
        '*PROGRESSION MILESTONE: Nyx Love: 25/100 | Divine Growth: 20/100.*'
      ],
      fallbackLines: [
        '*Raat ki thandi hawa tumhare baalon ko lehrati hai.*',
        'Nyx: "Tumhara safar abhi shuru hua hai."'
      ],
      choices: [
        {
          id: 'c4_accept_underworld_invitation',
          text: '"Aap jahan le chalengi, main wahan chalne ko tayyar hoon."',
          shortLabel: 'Dawat qabool karo',
          keywords: ['underworld', 'tayyar', 'nyx', 'safar'],
          next: 's5_night_realm_gateway',
          effects: {
            relationships: { nyx: 10 },
            flags: { acceptedUnderworld: true },
            memory: ['{{playerName}} ne Nyx ke Underworld aane ka dawat-nama qubool kiya.']
          }
        },
        {
          id: 'c4_ask_about_destiny',
          text: '"Is vardan ke sath mere upar kya zimmedari aayegi, Nyx?"',
          shortLabel: 'Zimmedari pucho',
          keywords: ['zimmedari', 'vardan', 'kismat', 'raaz'],
          next: 's5_night_realm_gateway',
          effects: {
            relationships: { nyx: 8 },
            memory: ['{{playerName}} ne zimmedari ke bare mein pucha jisse Nyx behad impress hui.']
          }
        }
      ]
    },
    {
      id: 's5_night_realm_gateway',
      title: 'Underworld Ka Darwaza Aur Anant Safar',
      narration: [
        '*Balcony ki zameen par ek obsidian kaala ghera banta hai, jismein sitare tair rahe hain.*',
        '*Nyx apna naram haath tumhari taraf badhati hai. Uske labon par ek aisi muskaan hai jo sirf tumhare liye mehfooz hai.*',
        'Nyx: "Yeh pehla kadam hai, {{playerName}}. Controlling maa ki bandishon se azaad hokar tum ab kainaat ke sabse bade raaz ke saathi ban rahe ho."',
        '*Yeh kahani yahan rukti nahi — har kadam ke sath naye devta aayenge, Olympus ki siyasat bhadkegi aur tumhara prem aur taakat badhti jayegi.*'
      ],
      fallbackLines: [
        '*Kaale sitaron bhara darwaza dheere-dheere lehrata hai.*',
        '*Tum jante ho ki tumhara astitva ab badal chuka hai.*'
      ],
      choices: [
        {
          id: 'c5_step_into_portal',
          text: 'Nyx ka haath thaam kar portal mein kadam rakho',
          shortLabel: 'Nyx ka haath thamo',
          keywords: ['portal', 'haath', 'kadam', 'safar'],
          next: 's1_olympus_balcony',
          effects: {
            relationships: { nyx: 5 },
            memory: ['{{playerName}} ne Nyx ka haath thaam kar Underworld ke naye arc ki taraf kadam badhaya.']
          }
        },
        {
          id: 'c5_look_back_olympus',
          text: 'Olympus ke mehal ki taraf dekh kar muskurao aur aage badho',
          shortLabel: 'Aage badho',
          keywords: ['olympus', 'muskaan', 'azaadi', 'safar'],
          next: 's1_olympus_balcony',
          effects: {
            relationships: { nyx: 5 },
            memory: ['{{playerName}} ne purani duniya ko peeche chhod kar Nyx ke sath naya daur shuru kiya.']
          }
        }
      ]
    }
  ]
};

export const story03 = {
  id: 'ghost-behind-the-quiet-boy',
  title: 'The Ghost Behind the Quiet Boy',
  tagline: 'Library ka sabse shareef ladka... dark web ka beraham badshah.',
  description: 'Tum {{playerName}} ho (alias Vihaan) — Imperial College ki library ke aakhri kone mein moti kitabon ke peeche chhupa ek seedha-saadha, masoom student. Duniya samajhti hai ki tumhein kisi se baat karna nahi aata. Lekin tumhari doosri pehchaan hai "The Ghost" — Dark Web ka sabse khaufnaak aur azeem hacker jiske ek code se sarkarein hil jaati hain. Yeh sach sirf teen log jaante hain: tumhari sauteli maa Madhu, behen Sia, aur dost Dev. Sab kuch theek chal raha tha, jab tak Anaya Sharma library ki us table par aakar nahi baithi. Uski tez nazar tumhare shareef chehre ke peeche chhupe shaitaan ko bhaampne lagi hai.',
  genres: ['College Drama', 'Mystery', 'Action', 'Secret Identity'],
  tags: ['secret-identity', 'dark-web', 'college', 'hacker', 'ongoing', 'hinglish'],
  ageRating: '12-17',
  contentLevel: 'teen',
  accentColor: '#10B981',
  userRole: '{{playerName}} (alias Vihaan) — ek masoom aur shant student jo secret mein Dark Web ka badshah The Ghost hai',
  setting: 'Imperial University campus, central library, underground server den, aur tech labs',
  openingSceneId: 's1_library_corner',
  tone: 'Fast-paced, suspenseful, Hinglish college thriller with smart observational banter and double-life tension.',
  safetyNotes: [
    'Violations of cybersecurity are depicted as high-tech fictional thriller tropes.',
    'No graphic gore or violence; tension comes from identity discovery and close encounters.',
    'Anaya is an intelligent, observant adult college student whose deductions build tension organically.',
    'Story is ongoing and expandable into campus secrets and corporate cyber wars.'
  ],
  characters: [
    {
      id: 'anaya',
      name: 'Anaya Sharma',
      role: 'Curious investigative student — 20 saal ki sharp, fearless aur observant ladki',
      personality: 'Khuli kitabon ki tarah baat karne wali, par logon ke chehre aur harkatein padhne mein maahir. Oversized cream sweater, tortoiseshell glasses aur haazri-jawabi uski pehchaan hai. Jhooth use turant samajh aa jata hai.',
      background: 'Campus investigative paper ki head writer. Ghost ke ek purane hack par article likhte hue use kuch ajeeb digital signals library ke paas mile.',
      goals: [
        'Ghost ke digital footprints ka sach pata lagana',
        'Vihaan ke masoom bholepan ke peeche ke ajeeb patterns ko decode karna',
        'Campus ke corrupt trustee ke racket ko expose karna'
      ],
      fears: ['Apne vishwas ka galat istemal hona', 'Sach ke itne kareeb aakar haar jaana'],
      likes: ['Filter coffee', 'Crosswords aur cryptograms', 'Direct aankhon mein dekh kar baat karna', 'Old library smell'],
      dislikes: ['Fake attitude', 'Log jo baat ghuma kar karein', 'Chori-chhupe kaam karne wale'],
      speakingStyle: 'Tez, playful, direct Hinglish. Har sentence mein ek chhota sa observational test ya trap hota hai.',
      sampleLine: 'Excuse me, kya ye seat khaali hai? Main yahan baith sakti hoon? Waise tum itni purani kernel architecture ki book kyun padh rahe ho?',
      relationshipWithUser: 'Intrigued and highly observant. Har movement par nazar rakhti hai.',
      knowledge: ['Ghost ke attack signatures', 'University ke private server layouts']
    },
    {
      id: 'dev',
      name: 'Dev',
      role: 'Best Friend & Tech Handler — 20 saal ka loyal coder dost',
      personality: 'Chilled-out, witty, thoda paranoid. Vihaan ke secret identity ko protect karne ke liye jaan daao par laga deta hai.',
      background: 'Vihaan ke sath bachpan se hai. Ghost ke proxy networks ko handle karta hai.',
      goals: ['Vihaan ki identity ko safe rakhna', 'Anaya ko kisi tarah doosre track par bhejte rehna'],
      fears: ['Ghost ka expose hona', 'Cyber police ki raid'],
      likes: ['Gaming rigs', 'Energy drinks', 'Sarcastic jokes'],
      dislikes: ['Librarians', 'Anaya ke teekhe sawaal'],
      speakingStyle: 'Collegiate bro Hinglish.',
      sampleLine: 'Bhai Anaya koi aam ladki nahi hai... FBI ki chachi hai woh! Sambhal ke!',
      relationshipWithUser: 'Bhai jaisa bharosemand sathi.',
      knowledge: ['Dark web relay nodes', 'Campus security schedules']
    }
  ],
  world: {
    premise: 'Imperial College mein {{playerName}} ek shareef, shant aur kam bolne wale student ke roop mein jaana jata hai. Magar raat ko dark web par uski hukumat chalti hai as "The Ghost". Jab Anaya Sharma library mein aakar uske theek samne baithti hai aur ajeeb sawaal karne lagti hai, toh masoomiyat ka naqab girne ka khatra paida ho jaata hai.',
    locations: [
      { id: 'library', name: 'Imperial Central Library (Floor 3)', description: 'Khamosh lamba corridor, purani kitabein, aur corner table jahan dhoop theharti hai.' },
      { id: 'cyber-den', name: 'Underground Server Basement', description: 'Ek purani abandoned lab ke neeche Ghost ka liquid-cooled server rig.' },
      { id: 'campus-cafe', name: 'Mocha & Code Cafe', description: 'Students ka adda jahan Anaya apne investigative notes banati hai.' }
    ],
    factions: [
      { id: 'the-ghost-network', name: 'Ghost Syndicate', description: 'Dark web ka elite circle jo corrupt systems ko expose karta hai.' },
      { id: 'campus-inquest', name: 'Campus Investigative Cell', description: 'Anaya ki choti dedicated team jo sacchai ki khoj mein hai.' }
    ],
    lore: [
      'Ghost ne pichle saal ek international bank ka illegal slush fund freeze kar diya tha.',
      'Vihaan ki stepmother Madhu aur sister Sia uske hacker hone ke sach ko ghar mein chhupa kar rakhti hain.'
    ],
    rules: [
      'Vihaan ki identity achanak pehle hi scene mein public nahi hogi; tension subtle clues se banegi.',
      'Anaya intelligent hai aur logical deductions se baat aage badhayegi.',
      'Kahani ongoing rahegi aur agle arcs mein naye corporate hacks aur campus mysteries aayenge.'
    ],
    importantObjects: [
      { id: 'dual-boot-phone', name: 'Encrypted Burner Phone', description: 'Ek aam sasta phone jismein custom Linux kernel par Ghost ka secure command line chalta hai.' }
    ],
    timeline: [
      'Ghost ka badshah banna aur dark web par chha jaana.',
      'Imperial College mein shant student identity banana.',
      'Anaya Sharma ka library table par aana.'
    ]
  },
  memory: {
    shortTermWindow: 14,
    seedMemories: [
      '{{playerName}} ka secret identity The Ghost hai, Dark Web ka azeem hacker.',
      'Sirf Madhu (stepmother), Sia (sister) aur Dev (friend) yeh sach jaante hain.',
      'Anaya Sharma ne library mein uski table par baith kar pehla sawaal pucha.'
    ],
    extractionHints: ['Hacking clues', 'Anaya ke observations', 'Dev warnings', 'Identity cover moves'],
    neverRemember: ['Real-world passwords', 'Personal bank pins']
  },
  scenes: [
    {
      id: 's1_library_corner',
      title: 'Khamosh Koshish Aur Anaya Ki Nazrein',
      narration: [
        '*Imperial College ki central library ka sabse aakhri corner. Yahan dhoop dhalne ke waqt halki peeli roshni aati hai. Tum {{playerName}} ho — table par moti algorithms aur physics ki kitabein phailaye ek masoom student ki tarah baithe ho.*',
        '*Tumhari jeb mein rakha phone ek silent pulse deta hai. Dark web ke encrypted server par ek naya alert: "The Ghost... contract fulfilled. 50 million transferred." Tum bina koi bhav dikhaye screen lock kar dete ho.*',
        '*Tabhi ek aawaz aati hai. Ek behad khoobsurat, tez aankhon wali ladki — oversized cream knitted sweater aur tortoiseshell glasses pehne — tumhari table ke paas aake khadi hoti hai.*',
        'Anaya: "Excuse me, kya ye seat khaali hai? Main yahan baith sakti hoon?"',
        '*Uski nazrein tumhari kitabon par ghoomti hain, aur phir tumhare chehre par thehar jaati hain — jaise woh koi aisi cheez dhoondh rahi ho jo yahan fit nahi baithti.*'
      ],
      fallbackLines: [
        '*Anaya notebook kholti hai par uski nazar tumhari ungliyon ke movement par rehti hai.*',
        'Anaya: "Aam tor par itne shant ladke library ke is kone mein nahi baithte."'
      ],
      choices: [
        {
          id: 'c1_innocent_student',
          text: 'Shareef bante hue kitabein sameto — "Haan bilkul, yahan koi nahi baitha. Aap baith sakti hain."',
          shortLabel: 'Seat aage badhao',
          keywords: ['seat', 'baitho', 'shareef', 'khali'],
          next: 's2_shareef_act',
          effects: {
            relationships: { anaya: 6 },
            flags: { playedQuietBoy: true },
            memory: ['{{playerName}} ne poori tarah shareef bante hue Anaya ko seat di.']
          }
        },
        {
          id: 'c1_question_motive',
          text: 'Shant nazar utha kar pucho — "Library mein bohot saari seats khali hain, yahan aane ki koi khaas wajah?"',
          shortLabel: 'Wajah pucho',
          keywords: ['wajah', 'khali', 'sawaal', 'dhyan'],
          next: 's2_sidha_sawaal',
          effects: {
            relationships: { anaya: 8 },
            flags: { showedSharpness: true },
            memory: ['{{playerName}} ne Anaya se pucha ki woh is kone mein kyun aayi.']
          }
        },
        {
          id: 'c1_witty_boundary',
          text: 'Dheemi muskaan ke sath chair aage badhao — "Sure. Par yahan shanti pasand log baithte hain."',
          shortLabel: 'Shanti pasand entry',
          keywords: ['shanti', 'muskaan', 'chair', 'pasand'],
          next: 's2_teaser_entry',
          effects: {
            relationships: { anaya: 7 },
            flags: { playfulBoundary: true },
            memory: ['{{playerName}} ne shanti ki shart par Anaya ko baithne diya.']
          }
        }
      ]
    },
    {
      id: 's2_shareef_act',
      title: 'Bholapan Ya Chhupa Hua Shikaari',
      narration: [
        '*Anaya chair kheench kar theek tumhare saamne baithti hai. Uski notebook par ek printed cyber article laga hai — jispar bada-bada likha hai: "THE GHOST: GHOST OF THE WEB".*',
        '*Tumhari ankhon mein koi react nahi hota, par tumhara dimaag second ke sau-wein hisse mein situation scan kar leta hai.*',
        'Anaya: "Thanks. Waise main Anaya hoon, Mass Comm third year. Tumhe pehle kabhi campus events mein nahi dekha... tum bohot low-profile rehte ho na?"',
        '*Uski hazel aankhein tumhare chehre ki ek-ek muscle ko observe kar rahi hain.*'
      ],
      fallbackLines: [
        '*Anaya pen ko apni ungliyon mein ghumati hai.*',
        'Anaya: "Khamosh log aksar sabse gehri baatein sochte hain."'
      ],
      choices: [
        {
          id: 'c2_normal_intro',
          text: '"Main {{playerName}} hoon. Bas padhai aur assignments mein hi waqt nikal jaata hai."',
          shortLabel: 'Normal student intro',
          keywords: ['padhai', 'student', 'waqt', 'assignments'],
          next: 's3_phone_buzz',
          effects: {
            relationships: { anaya: 5 },
            memory: ['{{playerName}} ne khud ko aam assignments mein uljha hua student dikhaya.']
          }
        },
        {
          id: 'c2_notice_article',
          text: 'Uski notebook ke article ki taraf ishara karo — "Yeh The Ghost par kya research chal rahi hai?"',
          shortLabel: 'Article par pucho',
          keywords: ['ghost', 'article', 'research', 'notebook'],
          next: 's3_phone_buzz',
          effects: {
            relationships: { anaya: 9 },
            flags: { baitedArticle: true },
            memory: ['{{playerName}} ne khud Anaya ke Ghost article par baat shuru ki.']
          }
        }
      ]
    },
    {
      id: 's2_sidha_sawaal',
      title: 'Anaya Ki Tez Nazrein Aur Test',
      narration: [
        '*Anaya ke hothon par ek teekhi muskaan aati hai. Woh apni files table par theek se rakhti hai.*',
        'Anaya: "Wajah? Kyunki is kone ki glass window se campus ka main server tower theek dikhta hai. Aur dusri wajah... tum."',
        '*Woh aage jhukti hai, uske tortoiseshell chashme ke peeche ki aankhein chamakti hain.*',
        'Anaya: "Poore college mein sirf tum akele student ho jo internet par kisi social media par nahi ho. Zero footprint. Aisa lagta hai jaise tumhara astitva hi exist nahi karta."',
        '*Tumhare dimaag mein ghanti bajti hai: Anaya ne pehle se background check kiya hai.*'
      ],
      fallbackLines: [
        '*Library ki hawa mein AC ki halki goonj hai.*',
        'Anaya: "Batao, itna chhupne ki kya zaroorat hai?"'
      ],
      choices: [
        {
          id: 'c2_calm_counter',
          text: '"Social media se door rehna gunah thodi hai? Mujhe bas screen time pasand nahi."',
          shortLabel: 'Screen time bahana',
          keywords: ['social media', 'screen', 'gunah', 'pasand'],
          next: 's3_phone_buzz',
          effects: {
            relationships: { anaya: 6 },
            memory: ['{{playerName}} ne social media na chalane ko personal choice bataya.']
          }
        },
        {
          id: 'c2_turn_tables',
          text: '"Tum mere baare mein itna research kyun kar rahi ho, Anaya? Kya tum mujhpar nazar rakh rahi thi?"',
          shortLabel: 'Nazar rakhna pucho',
          keywords: ['nazar', 'research', 'anaya', 'kyun'],
          next: 's3_phone_buzz',
          effects: {
            relationships: { anaya: 9 },
            flags: { turnedTables: true },
            memory: ['{{playerName}} ne table ghuma kar Anaya se poocha ki woh uspe nazar kyun rakh rahi hai.']
          }
        }
      ]
    },
    {
      id: 's2_teaser_entry',
      title: 'Halki Nok-Jhok Aur Clues',
      narration: [
        '*Anaya chair par baithte hue apne oversized sweater ki aasteen upar karti hai.*',
        'Anaya: "Shanti pasand? Par tumhare table par jo terminal architecture ki German book rakhi hai, woh shanti se zyada cyber war sikhati hai."',
        '*Uski nazar tumhare laptop bag par padti hai, jahan ek customised high-gain Wi-Fi dongle ka halka connector bahar jhaank raha hai.*',
        '*Anaya ki aankhein use pehchan leti hain — par woh abhi kuch bolti nahi. Bas ek gehri saans leti hai.*'
      ],
      fallbackLines: [
        '*Kitabon ke panno ki palatne ki aawaz aati hai.*',
        'Anaya: "Tum jitna masoom ban rahe ho, utne ho nahi."'
      ],
      choices: [
        {
          id: 'c2_hide_dongle',
          text: 'Bina ghabraye natural tareeqe se bag theek karo aur muskurao',
          shortLabel: 'Bag sambhalo',
          keywords: ['bag', 'dongle', 'natural', 'muskaan'],
          next: 's3_phone_buzz',
          effects: {
            relationships: { anaya: 7 },
            memory: ['{{playerName}} ne natural tareeqe se apna dongle cover kiya.']
          }
        },
        {
          id: 'c2_curious_banter',
          text: '"Agar book interesting lage toh tum bhi padh sakti ho, Anaya."',
          shortLabel: 'Book offer karo',
          keywords: ['book', 'german', 'padho', 'anaya'],
          next: 's3_phone_buzz',
          effects: {
            relationships: { anaya: 8 },
            memory: ['{{playerName}} ne Anaya ko book offer karke distract kiya.']
          }
        }
      ]
    },
    {
      id: 's3_phone_buzz',
      title: 'Dev Ka Emergency Signal',
      narration: [
        '*Usi waqt tumhare phone par ek specific rhythm mein triple-vibrate hota hai. Dev ka panic code!*',
        '*Screen par ek pop-up blink karta hai: "Ghost... someone is tracing the campus subnet right now. Source is inside this library!"*',
        '*Tum Anaya ki taraf dekhte ho. Uski tablet screen par ek network sniffing app chal raha hai jismein Wi-Fi packets scan ho rahe hain!*',
        'Anaya: "Kuch ajeeb ho raha hai yahan. Ek encrypted signal baar-baar is hall se ping kar raha hai."',
        '*Uski nazrein tumhare laptop bag se lekar tumhare chehre par aati hain.*'
      ],
      fallbackLines: [
        '*Network scanner ki beeps Anaya ke earphone mein sunayi de rahi hain.*',
        'Anaya: "Signal bilkul hamari table ke kareeb hai."'
      ],
      choices: [
        {
          id: 'c3_reroute_proxy',
          text: 'Secret phone se ek single touch karke signal ko admin building par reroute kar do',
          shortLabel: 'Signal reroute karo',
          keywords: ['reroute', 'signal', 'admin', 'touch'],
          next: 's4_anaya_deduction',
          effects: {
            relationships: { anaya: 8 },
            flags: { reroutedGhost: true },
            memory: ['{{playerName}} ne second ke sau-wein hisse mein signal admin block par reroute kar diya.']
          }
        },
        {
          id: 'c3_play_clueless',
          text: 'Masoom bankar pucho — "Signal? Kya college ka Wi-Fi phir se down ho gaya?"',
          shortLabel: 'Clueless bano',
          keywords: ['wi-fi', 'clueless', 'down', 'college'],
          next: 's4_anaya_deduction',
          effects: {
            relationships: { anaya: 5 },
            memory: ['{{playerName}} ne Wi-Fi down hone ka bholapan dikhaya.']
          }
        }
      ]
    },
    {
      id: 's4_anaya_deduction',
      title: 'Anaya Ki Uljhan Aur Khel Ka Naya Mod',
      narration: [
        '*Anaya ki screen par signal jump karta hai aur admin building par dikhne lagta hai.*',
        '*Anaya hairan hokar apna sir pakadti hai aur chashma theek karti hai.*',
        'Anaya: "Wait... yeh kaise hua? Signal abhi yahan tha, achanak teen so meter door chala gaya? Yeh Ghost sach mein koi bhoot hai kya?"',
        '*Woh tumhari taraf dekhti hai. Tumhare chehre par wahi shaant, masoom muskaan hai.*',
        'Anaya: "{{playerName}}... tum chahe kitne bhi bhole dikho, par tumhari aankhein kehti hain ki tum bohot kuch jaante ho."',
        '*Uski aawaz mein ab shaq ke sath-sath ek ajeeb sa aakarshan aur respect hai.*'
      ],
      fallbackLines: [
        '*Library ki peeli roshni mein Anaya ka chehra chamakta hai.*',
        'Anaya: "Main tumhara peecha itni jaldi nahi chhodne wali."'
      ],
      choices: [
        {
          id: 'c4_challenge_anaya',
          text: '"Agar main kuch jaanta bhi hoon, toh tumhe pata lagana padega, Anaya."',
          shortLabel: 'Challenge do',
          keywords: ['challenge', 'pata lagao', 'anaya', 'khel'],
          next: 's5_secret_alliance_hook',
          effects: {
            relationships: { anaya: 10 },
            flags: { acceptedChallenge: true },
            memory: ['{{playerName}} ne Anaya ko playful challenge diya ki sach pata lagana aasan nahi hoga.']
          }
        },
        {
          id: 'c4_offer_coffee_help',
          text: '"Chalo cafe chalte hain. Padhai ke baad filter coffee par tumhari Ghost story sunte hain."',
          shortLabel: 'Cafe ka offer do',
          keywords: ['cafe', 'coffee', 'story', 'chalo'],
          next: 's5_secret_alliance_hook',
          effects: {
            relationships: { anaya: 9 },
            flags: { coffeeDateOpened: true },
            memory: ['{{playerName}} ne Anaya ko coffee par chalne ka offer diya.']
          }
        }
      ]
    },
    {
      id: 's5_secret_alliance_hook',
      title: 'Dosti Ya Shikaar: Kahani Ka Aage Ka Rasta',
      narration: [
        '*Anaya apni diary band karti hai aur uske chehre par ek pyaari, confident muskaan aati hai.*',
        'Anaya: "Deal. Filter coffee tumhari taraf se hogi, {{playerName}}. Aur yaad rakhna... agar tumne koi galti ki, toh sabse pehle main pakdungi."',
        '*Tum library se nikalte ho. Shaam ka aasmaan gulabi aur neela ho chuka hai. Tumhara phone ek baar phir vibrate karta hai: dark web par naya target live hai.*',
        '*Yeh double life ka khel yahan khatam nahi hota — har din Anaya ke sath takkar, naye cyber operations aur dabi hui mohabbat ke naye panne khulenge.*'
      ],
      fallbackLines: [
        '*Campus ki hawa mein thandi khushboo phaili hui hai.*',
        '*Ghost ka badshah ab apni agli chaal chalne ke liye tayyar hai.*'
      ],
      choices: [
        {
          id: 'c5_walk_with_anaya',
          text: 'Anaya ke sath canteen ki taraf chalte hue agla kadam uthao',
          shortLabel: 'Anaya ke sath chalo',
          keywords: ['anaya', 'canteen', 'chalo', 'safar'],
          next: 's1_library_corner',
          effects: {
            relationships: { anaya: 5 },
            memory: ['{{playerName}} Anaya ke sath agle chapter ki taraf muskura kar badha.']
          }
        },
        {
          id: 'c5_check_ghost_terminal',
          text: 'Underground lab mein jaakar agle mission ki command line tayyar karo',
          shortLabel: 'Ghost mission jao',
          keywords: ['mission', 'terminal', 'ghost', 'hacker'],
          next: 's1_library_corner',
          effects: {
            relationships: { anaya: 3 },
            memory: ['{{playerName}} ne The Ghost ke agle operation ke liye systems initialize kiye.']
          }
        }
      ]
    }
  ]
};
