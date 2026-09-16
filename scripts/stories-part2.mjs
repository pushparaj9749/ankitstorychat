export const story04 = {
  id: 'girlfriends-unlimited',
  title: 'Girlfriends Unlimited',
  tagline: 'Ek anokha app upgrade, ek ₹4,200 crore ki CEO, aur Mumbai ka sabse bada game.',
  description: 'Tum {{playerName}} ho — 9-to-5 ki ghissi-pitti naukri, sar par lakhon ka karz aur dating apps par continuous rejections. Ek aadhi raat ko tumhare saste phone par notification chamakta hai: "App updated to UnHinge Pro." Pehla match screen par khulta hai: Malvika Mehta, 26 saal, CEO of Mehta Shipping Group, Net Worth ₹4,200 crore. System ka ek hi niyam hai: jitna gehra rishta tum matched aurat ke sath banaoge, uski daulat, shaurat aur power tumhare sath sync hoti chali jayegi. Lekin Malvika koi aam ladki nahi — woh Mumbai ke corporate samundar ki sabse tez shark hai. Ek galat kadam aur tum jail ya samundar ki talhati mein miloge.',
  genres: ['Modern Fantasy', 'System', 'Wealth', 'Romance', 'Action'],
  tags: ['system', 'billionaire', 'mumbai', 'unhinge-pro', 'ongoing', 'hinglish'],
  ageRating: '18+',
  contentLevel: 'mature',
  accentColor: '#F59E0B',
  userRole: '{{playerName}} — ek karzdar aam ladka jise UnHinge Pro system mila hai aur Malvika Mehta se pehli takkar hui hai',
  setting: 'Mumbai — Marine Drive, Bandra luxury private club, rooftop penthouse, aur container shipping docks',
  openingSceneId: 's1_unhinge_first_match',
  tone: 'High-roller modern urban fantasy, stylish Mumbai nights, sharp business stakes, luxury and edge.',
  safetyNotes: [
    'System progression is tied to genuine emotional and strategic interaction.',
    'Malvika is an intelligent, guarded adult CEO who tests the player thoroughly.',
    'No graphic gore; action is cinematic and pulse-pounding.',
    'Story is ongoing and expandable to future matches across global cities.'
  ],
  characters: [
    {
      id: 'malvika',
      name: 'Malvika Mehta',
      role: 'CEO, Mehta Shipping Group — 26 saal ki fierce, brilliant aur ruthless businesswoman',
      personality: 'Sharp cat eyes, sleek jet-black bob haircut, tailored navy designer suit, Rolex Daytona. Jhooth ko das second mein pakad leti hai, par andar se ek aisi shaksiyat jo kisi barabar ke nishchay wale sathi ki talash mein hai.',
      background: 'Pita ke bimar hone ke baad pure maritime empire ki kamaan sambhali. Competitors ne use girane ki har koshish ki par usne sabko koot diya.',
      goals: [
        'Mehta Shipping ko Asia ka sabse bada logistics fleet banana',
        'Apne khilaaf chal rahi shipping union ki conspiracy ko todna',
        'Kisi aise sathi ko dhoondhna jo uski daulat se nahi, uske dimaag se jude'
      ],
      fears: ['Apne parivar ke empire ka bikhar jaana', 'Kisi dhokhebaz par bharosa karna'],
      likes: ['Double shot black espresso', 'Marine Drive ki late-night drives', 'Fearless confidence', 'Calculated risks'],
      dislikes: ['Fake compliments aur maskhari', 'Kamzor dimaag wale log', 'Unpunctuality'],
      speakingStyle: 'Authoritative, crisp, affluent South Bombay Hinglish. Sharp and razor-precise.',
      sampleLine: 'Main deal table par baithe logon ki aukaat teen second mein naap leti hoon, {{playerName}}. Batao, tum mere waqt ke layak kyun ho?',
      relationshipWithUser: 'Current Match: Malvika Mehta. Status: Stranger. Threat Level: High. Sync pending.',
      knowledge: ['Mumbai port customs corruption', 'International logistics cartels']
    },
    {
      id: 'unhinge-system',
      name: 'UnHinge System',
      role: 'Quantum Dating & Wealth Synchronizer AI',
      personality: 'Cold, sleek, digital interface with witty status alerts and calculating precision.',
      background: 'Unknown origin quantum app update.',
      goals: ['Host ki net worth aur girlfriend sync network ko expand karna'],
      fears: ['Host ka terminate ho jaana'],
      likes: ['High net worth synchronizations', 'Bold romantic moves'],
      dislikes: ['Cowardice', 'Zero progression'],
      speakingStyle: 'Digital AI system alerts.',
      sampleLine: '[ALERT: Heart rate elevated. Malvika suspicion: 78%. Recommended response: Calculated arrogance.]',
      relationshipWithUser: 'System interface guide.',
      knowledge: ['City wealth indices', 'Target profiles']
    }
  ],
  world: {
    premise: 'Mumbai ki ameer aur andheri galiyon mein {{playerName}} ko UnHinge Pro ka mysterious update milta hai. Har successful relationship sync hone par matched aurat ki daulat, connections aur taakat {{playerName}} ki ban jaati hai. Shuruaat hoti hai Malvika Mehta se — ₹4,200 crore ki shipping tycoon jiske teekhe tewar se pura sheher darta hai.',
    locations: [
      { id: 'bandra-rooftop', name: 'The Obsidian Lounge, Bandra', description: 'Arabian Sea ko dekhta hua exclusive high-roller rooftop bar.' },
      { id: 'mehta-hq', name: 'Mehta Shipping Headquarters, Fort', description: 'British-era heritage building ke andar ultra-modern high-tech corporate office.' },
      { id: 'dockyard-9', name: 'JNPT Dockyard Berth 9', description: 'Raat ke waqt heavy cargo containers aur shadow deals ka dangerous adda.' }
    ],
    factions: [
      { id: 'mehta-group', name: 'Mehta Shipping Empire', description: 'Mumbai ke ports ko control karne wala 4200-crore ka logistics giant.' },
      { id: 'dock-syndicate', name: 'Coastal Syndicate', description: 'Underworld shipping smugglers jo Malvika ke cargo ko hijack karna chahte hain.' }
    ],
    lore: [
      'UnHinge Pro sirf unhe milta hai jo qismat ke sabse nichle paydan par hote hain par dimaag shatir ho.',
      'Sync sirf tab complete hota hai jab ladki dil se tum par vishwas kare.'
    ],
    rules: [
      'Progression stats functional hain: Girlfriends Confirmed, Net Worth Synced, Threat Level.',
      'Malvika aasani se bharosa nahi karegi; player ko apni aukaat prove karni hogi.',
      'Kahani ongoing aur expandable rahegi.'
    ],
    importantObjects: [
      { id: 'unhinge-app', name: 'UnHinge Pro Interface', description: 'Golden glowing mobile app jo real-time threat aur synchronization data dikhata hai.' }
    ],
    timeline: [
      'UnHinge Pro ka mysterious midnight installation.',
      'Malvika Mehta ke match hone ke baad Bandra lounge encounter.',
      'First Wealth Sync aur Dockyard crisis.'
    ]
  },
  memory: {
    shortTermWindow: 14,
    seedMemories: [
      '{{playerName}} ko UnHinge Pro mila hai: First match Malvika Mehta (Net Worth ₹4,200 crore).',
      'System: Girlfriends Confirmed: 0, Net Worth Synced: ₹0, Threat Level: High.',
      'Malvika ek sharp businesswoman hai jo kisi par jaldi trust nahi karti.'
    ],
    extractionHints: ['System alerts', 'Malvika ke reactions', 'Sync percentage', 'Financial upgrades'],
    neverRemember: ['Real-world passwords', 'Personal bank pins']
  },
  scenes: [
    {
      id: 's1_unhinge_first_match',
      title: 'UnHinge Pro Ka Aagaz Aur Malvika Ka Samna',
      narration: [
        '*Mumbai ki garm raat. Ek purane fan ki aawaz aur table par unpaid bills ka dher. Tum {{playerName}} ho — ordinary job, extraordinary debt aur roz ki thakan.*',
        '*Achanak tumhare saste phone ki screen chamakti hai. Ek sleek golden interface poori screen par chha jaata hai.*',
        '*SYSTEM: "App updated to UnHinge Pro. Status: Activated."*',
        '*SYSTEM: "First Match: Malvika Mehta. Age: 26. Designation: CEO, Mehta Shipping Group. Net Worth: ₹4,200 crore."*',
        '*SYSTEM: "Girlfriends Confirmed: 0 | Net Worth Synced: ₹0 | Current Match: Malvika Mehta | Match Status: Stranger | Threat Level: High."*',
        '*Screen par Bandra ke Obsidian Lounge ki live location aati hai. Malvika wahan akeli martini glass haath mein liye samundar ki taraf dekh rahi hai. System alert: "She is waiting for a contact. You have 15 minutes."*'
      ],
      fallbackLines: [
        '*Phone ka golden icon halka vibrate karta hai.*',
        '*SYSTEM: "Target is observant. Move with absolute composure."*'
      ],
      choices: [
        {
          id: 'c1_bold_table_entry',
          text: 'Lounge mein jaakar direct confidence ke sath saamne baitho — "Lagta hai aapki meeting ka contact late hai, Miss Mehta."',
          shortLabel: 'Bold approach karo',
          keywords: ['bold', 'mehta', 'baitho', 'contact'],
          next: 's2_bold_approach',
          effects: {
            relationships: { malvika: 6 },
            flags: { boldEntry: true },
            memory: ['{{playerName}} ne direct Malvika ki table par fearless entry maari.']
          }
        },
        {
          id: 'c1_tactical_wait',
          text: 'Bar counter se pehle uski body language observe karo aur system analysis run karo',
          shortLabel: 'Observe aur scan',
          keywords: ['observe', 'scan', 'system', 'bar'],
          next: 's2_tactical_observation',
          effects: {
            relationships: { malvika: 4 },
            flags: { scannedMalvika: true },
            memory: ['{{playerName}} ne pehle Malvika ki body language ko strategically scan kiya.']
          }
        },
        {
          id: 'c1_insider_comment',
          text: 'Ek waiter ke zariye special single malt bhejte hue ek sharp logistics note bhejo',
          shortLabel: 'Logistics note bhejo',
          keywords: ['note', 'drink', 'logistics', 'malt'],
          next: 's2_system_tip',
          effects: {
            relationships: { malvika: 8 },
            flags: { sentSmartNote: true },
            memory: ['{{playerName}} ne Malvika ko shipping logistics se judaa sharp note bhej kar impress kiya.']
          }
        }
      ]
    },
    {
      id: 's2_bold_approach',
      title: 'Obsidian Lounge Ka Confrontation',
      narration: [
        '*Tum Malvika ki table ke saamne wali leather chair par baithte ho. Rooftop ki tez hawa uske sleek black bob baalon ko chhooti hai.*',
        '*Uski cat eyes tumhari ankhon mein aise gadhti hain jaise koi scanner chal raha ho. Usne martini ka sip liya aur glass table par rakha.*',
        'Malvika: "Tumhari himmat ki daad deni padegi. Is club mein log meri table ki taraf dekhne se pehle do baar sochte hain, aur tum sidha yahan baith gaye."',
        '*Uski diamond ring roshni mein chamakti hai. Aawaz mein shaan aur shaq dono hain.*',
        'Malvika: "Batao... kis competitor ne bheja hai tumhe? Ya bas koi aam stalker ho jise apni jaan ki parwah nahi?"'
      ],
      fallbackLines: [
        '*Malvika ki bodyguards balcony ke kone mein alert ho rahe hain.*',
        'Malvika: "Teen second hain tumhare paas, {{playerName}}."'
      ],
      choices: [
        {
          id: 'c2_counter_with_value',
          text: '"Competitor nahi, Miss Mehta. Main woh hoon jo aapke Berth 9 ke illegal cartel ka rasta rok sakta hai."',
          shortLabel: 'Berth 9 ka sach bolo',
          keywords: ['berth 9', 'cartel', 'value', 'shout'],
          next: 's3_malvika_interrogation',
          effects: {
            relationships: { malvika: 9 },
            flags: { revealedBerth9: true },
            memory: ['{{playerName}} ne Berth 9 ke raaz ka zikr karke Malvika ke hosh uda diye.']
          }
        },
        {
          id: 'c2_charm_and_nerve',
          text: '"Aapko dekh kar lagta hai ki aap har insaan mein dushman dhoondhti hain. Kabhi kisi barabar wale se milne ka mann nahi hota?"',
          shortLabel: 'Barabar wale ki baat',
          keywords: ['barabar', 'dushman', 'muskaan', 'charm'],
          next: 's3_malvika_interrogation',
          effects: {
            relationships: { malvika: 7 },
            memory: ['{{playerName}} ne Malvika ke akelepan aur barabari par teekha punch mara.']
          }
        }
      ]
    },
    {
      id: 's2_tactical_observation',
      title: 'System Analysis Aur Pehla Attack',
      narration: [
        '*Bar counter par khade hokar tumne phone ka interface active kiya.*',
        '*SYSTEM: "Target Analysis: High stress in left shoulder. Rolex Daytona time set 5 minutes fast. Expected betrayal from logistics director."*',
        '*Tum uski table par aate ho theek us waqt jab uska phone ek frantic call se bajta hai.*',
        'Malvika: "Damn it, Sharma ne shipment hold kar di!"',
        '*Tum bina hichkichaye bolte ho: "Sharma ne nahi, uske peeche coastal syndicate ka haath hai, Miss Mehta. Agar aap sunna chahein toh mere paas solution hai."*'
      ],
      fallbackLines: [
        '*Malvika phone kaan se hatati hai aur tumhari taraf ghoomti hai.*',
        'Malvika: "Tumhe yeh baat kaise pata chali?"'
      ],
      choices: [
        {
          id: 'c2_explain_solution',
          text: 'Confidence se baith kar logistics solution samjhao',
          shortLabel: 'Solution samjhao',
          keywords: ['solution', 'logistics', 'baitho', 'samjhao'],
          next: 's3_malvika_interrogation',
          effects: {
            relationships: { malvika: 8 },
            memory: ['{{playerName}} ne system data se accurate solution deliver kiya.']
          }
        },
        {
          id: 'c2_demand_partnership',
          text: '"Information muft nahi milti. Pehle mujhe barabar ka partner maaniye."',
          shortLabel: 'Barabari maango',
          keywords: ['partner', 'muft', 'shart', 'information'],
          next: 's3_malvika_interrogation',
          effects: {
            relationships: { malvika: 9 },
            memory: ['{{playerName}} ne pehle hi din barabar ke partner ka darja maanga.']
          }
        }
      ]
    },
    {
      id: 's2_system_tip',
      title: 'Whisky Glass Aur Sharp Note',
      narration: [
        '*Waiter ne single malt ka glass Malvika ke aage rakha, aur sath mein tumhara tissue note: "Berth 9 is compromised tonight. Don\'t sign the manifest."*',
        '*Malvika ne note padha, uski palke thodi sikudi. Woh table se uthi aur sidha tumhare counter ki taraf chalkar aayi.*',
        '*Uski high heels ki khanak lounge ke music ke beech saaf goonj rahi thi.*',
        'Malvika: "Note tumne bheja tha? Kaun ho tum, aur tumhe kaise pata chala ki mere signature ka trap banaya gaya tha?"'
      ],
      fallbackLines: [
        '*Malvika ki perfume ki khushboo amber aur citrus jaisi sharp hai.*',
        'Malvika: "Jawab do, {{playerName}}."'
      ],
      choices: [
        {
          id: 'c2_invite_private_chat',
          text: '"Yahan sabke kaan hain. Private booth mein baithkar baat karein?"',
          shortLabel: 'Private booth chalo',
          keywords: ['private', 'booth', 'kaan', 'baat'],
          next: 's3_malvika_interrogation',
          effects: {
            relationships: { malvika: 8 },
            memory: ['{{playerName}} ne Malvika ko private booth mein invite karke control banaya.']
          }
        },
        {
          id: 'c2_direct_look',
          text: '"Main wahi hoon jo aapke empire ko dubne se bacha sakta hai."',
          shortLabel: 'Direct look do',
          keywords: ['empire', 'bachao', 'look', 'seedha'],
          next: 's3_malvika_interrogation',
          effects: {
            relationships: { malvika: 7 },
            memory: ['{{playerName}} ne Malvika ki ankhon mein dekh kar fearless response diya.']
          }
        }
      ]
    },
    {
      id: 's3_malvika_interrogation',
      title: 'Test Of Will: Malvika Ka Sawaal',
      narration: [
        '*Private corner booth mein Malvika tumhare saamne baithi hai. Uski body language ab thodi defensive hai.*',
        'Malvika: "Main South Mumbai ke top lawyers aur security chiefs ko janti hoon. Par tum... tumhara koi record nahi hai. Tum achanak hawa se tapke ho."',
        '*Woh aage jhukti hai, uske chehre par ek curious smirk ubharta hai.*',
        'Malvika: "Par tumhare dimaag mein kuch toh alag hai. Mujhe impress karna impossible hai, par tumne mujhe dhyan dene par majboor kar diya. Kya chahiye tumhe mujhse? Paisa?"',
        '*SYSTEM PROMPT: Malvika Trust: 22% | Attraction: 35% | Synchronization Available!*'
      ],
      fallbackLines: [
        '*Malvika glass ko halke se ghumati hai.*',
        'Malvika: "Sachi baat bolna, {{playerName}}, jhooth mujhe pasand nahi."'
      ],
      choices: [
        {
          id: 'c3_not_money',
          text: '"Paisa nahi, Miss Mehta. Mujhe aapke barabar khada hona hai — Mumbai ke top par."',
          shortLabel: 'Top par khade hona',
          keywords: ['paisa', 'top', 'barabar', 'mumbai'],
          next: 's4_first_sync_moment',
          effects: {
            relationships: { malvika: 12 },
            flags: { rejectedEasyMoney: true },
            memory: ['{{playerName}} ne aam paise ke lalach ko thukra kar Malvika ke barabar aane ka jazba dikhaya.']
          }
        },
        {
          id: 'c3_prove_worth_first',
          text: '"Pehle main aapko Berth 9 bacha kar dikhaunga. Uske baad jo haq banega, woh lunga."',
          shortLabel: 'Pehle haq prove karo',
          keywords: ['haq', 'prove', 'berth 9', 'action'],
          next: 's4_first_sync_moment',
          effects: {
            relationships: { malvika: 10 },
            flags: { actionFirst: true },
            memory: ['{{playerName}} ne pehle action se result dene ka wada kiya.']
          }
        }
      ]
    },
    {
      id: 's4_first_sync_moment',
      title: 'First Synchronization: Power Aur Wealth',
      narration: [
        '*Malvika tumhari ankhon mein dekhti hai aur pehli baar uske chehre se cold mask thoda fisalta hai. Ek sachhi, gehrai bhari muskaan.*',
        'Malvika: "Theek hai, {{playerName}}. Aaj raat Berth 9 par mere sath chalo. Dekhte hain tum kitna dum rakhte ho."',
        '*Usi pal tumhara phone jeb mein tez vibrate karta hai.*',
        '*SYSTEM NOTIFICATION: "Synchronization Milestone Achieved!"*',
        '*SYSTEM: "Match Status: Strategic Ally | Malvika Trust: 40% | Net Worth Synced: ₹10 Crore (Initial Line of Credit) | City Reputation: Emerging Figure."*',
        '*Tumhare bank app par ek notification pop up hota hai: Account balance updated to ₹10,00,00,000!*'
      ],
      fallbackLines: [
        '*Malvika apni car keys uthati hai.*',
        'Malvika: "Chalo, meri Porsche bahar khadi hai."'
      ],
      choices: [
        {
          id: 'c4_ride_with_malvika',
          text: 'Malvika ke sath Porsche mein baithkar docks ki taraf niklo',
          shortLabel: 'Porsche mein niklo',
          keywords: ['porsche', 'docks', 'niklo', 'malvika'],
          next: 's5_dockyard_alliance',
          effects: {
            relationships: { malvika: 8 },
            memory: ['{{playerName}} Malvika ke sath Porsche mein dockyard operation ke liye nikla.']
          }
        },
        {
          id: 'c4_take_command',
          text: '"Car main chalaunga Miss Mehta, aap security updates check kijiye."',
          shortLabel: 'Car drive karo',
          keywords: ['drive', 'car', 'command', 'chalao'],
          next: 's5_dockyard_alliance',
          effects: {
            relationships: { malvika: 10 },
            flags: { drovePorsche: true },
            memory: ['{{playerName}} ne khud Porsche drive karke dominant confidence dikhaya.']
          }
        }
      ]
    },
    {
      id: 's5_dockyard_alliance',
      title: 'Mumbai Port Ki Raat Aur Agla Target',
      narration: [
        '*JNPT Berth 9. Hawa mein samundar ke namak aur diesel ki khushboo hai. Unche cargo containers andhere mein qile jaise khade hain.*',
        '*Malvika tumhare theek bagal mein khadi hai, uski aasteen upar mudi hui aur ankhon mein shikaar ka nasha.*',
        'Malvika: "Hum dono ne milkar aaj raat Mumbai ke sabse bade syndicate ko maat di hai, {{playerName}}. Par yeh bas shuruaat hai."',
        '*Woh tumhari taraf mudti hai, uske haath tumhare coat ke lapel par theharte hain.*',
        'Malvika: "Ab tum sirf mere partner nahi ho... tum meri kamzori banne ki raah par ho. Aur main kisi ko apni kamzori nahi banne deti... bina wajeh."',
        '*SYSTEM ALERT: "Arc 1 Complete. New Matches Unlocking in Delhi and Dubai. Overall Net Worth Potential: Infinite. The journey continues."*'
      ],
      fallbackLines: [
        '*Samundar ki lehrein berth ke lohe se takra rahi hain.*',
        '*Malvika ki nazrein tumse nahi hatati.*'
      ],
      choices: [
        {
          id: 'c5_hold_hand_promise',
          text: 'Malvika ka haath thamo aur kaho — "Main kamzori nahi, aapki sabse badi taakat banunga."',
          shortLabel: 'Taakat banne ka wada',
          keywords: ['taakat', 'haath', 'wada', 'malvika'],
          next: 's1_unhinge_first_match',
          effects: {
            relationships: { malvika: 8 },
            memory: ['{{playerName}} ne Malvika ko uski sabse badi taakat banne ka wada kiya.']
          }
        },
        {
          id: 'c5_expand_empire',
          text: 'Sheher ki lighton ko dekh kar bolo — "Ab poori Mumbai par hamara raaj hoga."',
          shortLabel: 'Mumbai par raaj',
          keywords: ['raaj', 'mumbai', 'empire', 'expansion'],
          next: 's1_unhinge_first_match',
          effects: {
            relationships: { malvika: 6 },
            memory: ['{{playerName}} ne pure sheher par raaj karne ka sankalp liya.']
          }
        }
      ]
    }
  ]
};

export const story05 = {
  id: 'contract-wali-shaadi',
  title: 'Contract Wali Shaadi',
  tagline: 'Billionaire ki majboori, ek masoom ladki ki zaroorat... aur ek kaagaz ka rishta.',
  description: 'Tum {{playerName}} ho — Singhania Enterprises ke ek laakh crore ke empire ke akele waris aur billionaire. Tumhari bhabhi Ruchika ne parivar aur board of directors ke samne ek aakhri shart rakh di hai: agar agle ek mahine mein tumhari shaadi nahi hui, toh company ke voting rights family trust ko chale jayenge. Office ke ahem din par tumhari mulaqat Akshara se hoti hai. Akshara ek behad shareef, mehanti aur swabhimani ladki hai, jise apni bimar choti behen ke ilaaj ke liye turant badi raqam ki zaroorat hai. Yeh mauqa banata hai ek zabardast mod: "Akshara ko contract marriage ka offer do... kya woh haan kahegi?"',
  genres: ['Romance', 'Billionaire Drama', 'Family Drama', 'Workplace'],
  tags: ['contract-marriage', 'billionaire', 'workplace', 'family', 'ongoing', 'hinglish'],
  ageRating: '18+',
  contentLevel: 'mature',
  accentColor: '#EC4899',
  userRole: '{{playerName}} — Singhania khandan ka young billionaire jise empire bachane ke liye ek contract marriage karni hai',
  setting: 'Singhania Towers corporate headquarters, South Delhi penthouse, aur traditional family haveli',
  openingSceneId: 's1_boardroom_ultimatum',
  tone: 'Emotional corporate romance, high stakes family pressure, Hinglish banter, gradual slow-burn trust.',
  safetyNotes: [
    'Contract marriage dynamics are consensual, professional, and emotionally respectful.',
    'Akshara has strong self-respect, moral agency, and individual goals.',
    'No abusive behaviour; relationship develops through genuine care and public/private situations.',
    'Story is ongoing and expandable into family drama and corporate mergers.'
  ],
  characters: [
    {
      id: 'akshara',
      name: 'Akshara',
      role: 'Junior Financial Associate & Contract Bride — 23 saal ki swabhimani, sundar aur committed ladki',
      personality: 'Khubsurat expressive ankhon wali ladki jinme dard bhi hai aur dridh nischay bhi. Peach pastel kurti, lambe wavy baal, naram par atmasamman se bhari aawaz. Bikharna ya jhukna nahi jaanti.',
      background: 'Middle-class parivar ki beti. Pita ke guzarne ke baad choti behen ki heart surgery ke 40 lakh ke kharche ke liye raat-din bhatak rahi hai.',
      goals: [
        'Choti behen ki surgery karwa kar use bachaana',
        'Contract marriage ki sharton ko imaandari se nibhana',
        'Singhania parivar ke ghamand ke aage apna aatmasamman bachaana'
      ],
      fears: ['Behen ki jaan jaana', 'Ameer khandan mein sirf ek khilona ban kar reh jaana'],
      likes: ['Ghar ki kheer', 'Saaf imaandari', 'Dheemi baarish', 'Pustakein padhna'],
      dislikes: ['Paison ka ghamand', 'Jhoothi baatein', 'Be-izzat kiya jaana'],
      speakingStyle: 'Naram, thehri hui, swabhiman se bhari Hinglish.',
      sampleLine: 'Paison ke badle main aapki nakli patni banne ko tayyar hoon, sir. Lekin yeh saaf rahe... mera aatmasamman bikaau nahi hai.',
      relationshipWithUser: 'Contract partner slowly turning into deep, emotional soulmate.',
      knowledge: ['Singhania corporate financial sheets', 'Hospital bills and family expenses']
    },
    {
      id: 'ruchika',
      name: 'Ruchika Bhabhi',
      role: 'Elder Sister-in-Law & Family Matriarch — 30 saal ki commanding businesswoman',
      personality: 'High-society poise, strict rules, {{playerName}} ko responsibility sikhana chahti hai.',
      background: 'Late elder brother ke share ko trust ke roop mein hold karti hai.',
      goals: ['Singhania empire ko stable aur parivar ko safe rakhna'],
      fears: ['Company par bahar walon ka qabza hona'],
      likes: ['Discipline', 'Status', 'Family lineage'],
      dislikes: ['Laparwahi', 'Delay'],
      speakingStyle: 'Polished, commanding South Delhi Hinglish.',
      sampleLine: 'Ek mahina hai tumhare paas, {{playerName}}. Shaadi karo ya signing rights surrender karo.',
      relationshipWithUser: 'Strict guardian sister-in-law.',
      knowledge: ['Family trust bylaws', 'Board members votes']
    }
  ],
  world: {
    premise: 'Singhania Towers ke 45th floor par ek laakh crore ke empire ki voting rights daao par hain agar {{playerName}} 30 din mein shaadi na kare. Office mein Akshara ki majboori aur behen ki bimari ek contract shaadi ka mauqa banati hai. Yeh kaagaz ka rishta dheere-dheere sacchi mohabbat aur parivarik siyasat mein badal jaata hai.',
    locations: [
      { id: 'boardroom', name: 'Singhania Towers 45th Floor Boardroom', description: 'Glass walls, leather swivel chairs, aur sheher ke upar phaila azeem corporate view.' },
      { id: 'md-cabin', name: 'Private Executive Suite', description: '{{playerName}} ka cabin jahan secret negotiations aur contract sign hote hain.' },
      { id: 'singhania-haveli', name: 'Singhania Haveli, South Delhi', description: 'Puraane zamane ka azeem mansion jahan Ruchika bhabhi ka pehra rehta hai.' }
    ],
    factions: [
      { id: 'singhania-board', name: 'Singhania Board of Directors', description: 'Purane share holders jo voting rights ke chhinne ka intezaar kar rahe hain.' }
    ],
    lore: [
      'Singhania khandan ka niyam hai ki bina parivar ke koi waris akele CEO nahi ban sakta.',
      'Akshara ki behen ki surgery 20 din ke andar hona zaroori hai.'
    ],
    rules: [
      'Contract marriage is the core story engine; agreements and boundaries evolve dynamically.',
      'Akshara dignity and autonomy must never be compromised.',
      'Story is ongoing and expandable indefinitely.'
    ],
    importantObjects: [
      { id: 'marriage-contract', name: 'Non-Disclosure Marriage Agreement', description: 'Ek saal ka legal bond: 40 lakh behen ke ilaaj ke liye, aur Singhania board ke samne patni ka darja.' }
    ],
    timeline: [
      'Ruchika bhabhi ka 30 din ka marriage ultimatum.',
      'Akshara ko contract marriage ka offer.',
      'Public appearance, family reception aur slow-burn feelings.'
    ]
  },
  memory: {
    shortTermWindow: 14,
    seedMemories: [
      '{{playerName}} ko Singhania empire bachane ke liye 30 din mein shaadi karni hai.',
      'Akshara ki behen ki surgery ke liye 40 lakh ki sakht zaroorat thi.',
      'Hook: "Akshara ko contract marriage ka offer do... kya woh haan kahegi?"'
    ],
    extractionHints: ['Contract terms', 'Ruchika observations', 'Akshara emotional moments', 'Public fake romance'],
    neverRemember: ['Real-world passwords', 'Personal bank pins']
  },
  scenes: [
    {
      id: 's1_boardroom_ultimatum',
      title: 'Ultimatum Aur Ek Majboor Inkaar',
      narration: [
        '*Singhania Towers ki 45th floor ka glass boardroom. Neeche poora sheher phaila hua hai. Tum {{playerName}} ho — Singhania Empire ke waris.*',
        '*Bhabhi Ruchika ne file table par rakh di hai. Unki nazron mein faisla saaf tha: "Agar agle 30 din mein tumne shaadi nahi ki, toh board control trust ko chala jayega."*',
        '*Meeting ke baad jab tum cabin mein aate ho, toh executive assistant ke paas ek ladki khadi milti hai — haath mein file liye, halki ghabrayi hui par ankhon mein dridh nischay. Peach kurti aur saadgi mein behad khubsurat: Akshara.*',
        '*Uske haath kaanp rahe hain kyunki HR ne advance salary loan reject kar diya hai. Uski choti behen hospital mein admit hai.*',
        '*Tumhare dimaag mein ek achanak khayal ghoomta hai: "Akshara ko contract marriage ka offer do... kya woh haan kahegi?"*'
      ],
      fallbackLines: [
        '*Akshara file ko seene se lagaye khadi hai, uski palkon par halki nami hai.*',
        'Akshara: "Please sir, mujhe advance ki sakht zaroorat hai... behen ka operation ruk jayega."'
      ],
      choices: [
        {
          id: 'c1_direct_proposal',
          text: 'Cabin ka darwaza band karke seedha contract offer do — "Akshara ji, baithiye. Mujhe ek deal karni hai jo hum dono ki mushkil hal kar sakti hai."',
          shortLabel: 'Contract offer do',
          keywords: ['deal', 'baithiye', 'contract', 'mushkil'],
          next: 's2_direct_proposal',
          effects: {
            relationships: { akshara: 6 },
            flags: { proposedContractDirectly: true },
            memory: ['{{playerName}} ne Akshara ko sidha contract marriage ka offer diya.']
          }
        },
        {
          id: 'c1_empathy_first',
          text: 'Pehle uski behen ki halat aur zaroorat ke bare mein naram lehje mein pucho',
          shortLabel: 'Pehle behen ka pucho',
          keywords: ['behen', 'hospital', 'naram', 'chinta'],
          next: 's2_empathy_first',
          effects: {
            relationships: { akshara: 9 },
            flags: { showedGenuineCare: true },
            memory: ['{{playerName}} ne pehle Akshara ki behen ki bimaari ke baare mein humdardi se pucha.']
          }
        },
        {
          id: 'c1_business_terms',
          text: 'Legal kaagaz nikaal kar professional tareeqe se poori shartein khulkar samjhao',
          shortLabel: 'Legal shartein batao',
          keywords: ['legal', 'shartein', 'kaagaz', 'terms'],
          next: 's2_business_terms',
          effects: {
            relationships: { akshara: 5 },
            flags: { businessOnlyApproach: true },
            memory: ['{{playerName}} ne poore legal terms professional tareeqe se samjhaye.']
          }
        }
      ]
    },
    {
      id: 's2_direct_proposal',
      title: 'Offer Ki Sachai Aur Akshara Ki Hairani',
      narration: [
        '*Akshara chair par baithti hai, uske chehre par ghabrahat aur ashcharya dono hain.*',
        'Akshara: "Deal? Sir, main yahan loan ke liye aayi thi... aap kis tarah ki deal ki baat kar rahe hain?"',
        '*Tum paani ka glass uski taraf badhate ho aur saaf shabdon mein bolte ho.*',
        '*Tum: "Ek saal ki contract marriage. Ek crore rupaye tumhari behen ki surgery aur future ke liye. Badle mein tumhe mere parivar aur board ke samne meri patni banna hoga."*',
        '*Akshara ki saans atak jaati hai. Uski hazel aankhein badi ho jaati hain.*',
        'Akshara: "Contract... shaadi? Aap mazak kar rahe hain na, sir?"'
      ],
      fallbackLines: [
        '*Akshara ka haath kaanp raha hai.*',
        'Akshara: "Shaadi koi kaagaz ka tukda nahi hoti, sir."'
      ],
      choices: [
        {
          id: 'c2_respectful_plea',
          text: '"Yeh koi mazaak nahi hai Akshara. Tumhari behen ki jaan bachegi aur mera empire. Koi physical boundary cross nahi hogi."',
          shortLabel: 'Izzat ki tasalli do',
          keywords: ['jaan', 'boundary', 'izzat', 'sach'],
          next: 's3_akshara_reaction',
          effects: {
            relationships: { akshara: 8 },
            memory: ['{{playerName}} ne maryada aur boundaries ki poori tasalli di.']
          }
        },
        {
          id: 'c2_give_time_to_think',
          text: '"Dobaara soch lo. Hospital ka bill kal subah tak bharte hain."',
          shortLabel: 'Sochne ka waqt do',
          keywords: ['socho', 'waqt', 'hospital', 'bill'],
          next: 's3_akshara_reaction',
          effects: {
            relationships: { akshara: 7 },
            memory: ['{{playerName}} ne Akshara par dabav nahi banaya aur sochne ka waqt diya.']
          }
        }
      ]
    },
    {
      id: 's2_empathy_first',
      title: 'Dard Ka Saathi Aur Bharosa',
      narration: [
        '*Tumhari narmi dekh kar Akshara ki ankhon se ek aasu fisal jaata hai.*',
        'Akshara: "Choti behen Pihu... sirf 9 saal ki hai sir. Doctors ne kaha agar is hafte surgery nahi hui toh bohot der ho jayegi. Par mere paas itne paise nahi hain."',
        '*Tum uske samne aakar khade hote ho. Uski bebasi dil ko chhoo leti hai.*',
        '*Tum: "Pihu ko kuch nahi hoga Akshara. Main uski surgery ka har kharcha uthane ko tayyar hoon. Par badle mein mujhe tumhari madad chahiye... meri contract patni ban kar."*',
        '*Akshara tumhari ankhon mein dekhti hai — wahan koi vasna ya ghamand nahi, balki ek sachhi majboori aur sahara dikhta hai.*'
      ],
      fallbackLines: [
        '*Akshara apne aasu ponchti hai.*',
        'Akshara: "Aap sach mein meri behen ki jaan bachayenge?"'
      ],
      choices: [
        {
          id: 'c2_promise_sister_life',
          text: '"Kasam se. Sabse pehle hospital cheque jayega, phir contract sign hoga."',
          shortLabel: 'Pehle cheque bhejo',
          keywords: ['kasam', 'cheque', 'hospital', 'pihu'],
          next: 's3_akshara_reaction',
          effects: {
            relationships: { akshara: 11 },
            flags: { paidHospitalFirst: true },
            memory: ['{{playerName}} ne contract sign hone se pehle Pihu ke hospital ka cheque clear karwaya.']
          }
        },
        {
          id: 'c2_reassure_dignity',
          text: '"Singhania ghar mein tumhe poori bahu ki izzat milegi."',
          shortLabel: 'Bahu ki izzat',
          keywords: ['bahu', 'izzat', 'ghar', 'wada'],
          next: 's3_akshara_reaction',
          effects: {
            relationships: { akshara: 9 },
            memory: ['{{playerName}} ne pure parivar ke samne Akshara ko samman dilane ka wada kiya.']
          }
        }
      ]
    },
    {
      id: 's2_business_terms',
      title: 'Rules Of The Agreement',
      narration: [
        '*Tum table par printed terms rakhte ho: 1. Public events mein patni ki tarah sath rehna. 2. Parivar ke samne sach kisi ko na batana. 3. Ek saal baad clean separation aur 1 crore settlement.*',
        '*Akshara dhyan se har clause padhti hai. Uski samajhdari aur tezi saaf dikhti hai.*',
        'Akshara: "Clause number four main jodna chahti hoon, sir. Yeh ki mere aatmasamman par koi aanch nahi aayegi, aur meri behen ka ilaaj sabse top surgeon se hoga."',
        '*Tumhe uski swabhimani aawaz sun kar garv hota hai.*'
      ],
      fallbackLines: [
        '*Akshara file par pen pakadti hai.*',
        'Akshara: "Bataiye, kya meri shart manzoor hai?"'
      ],
      choices: [
        {
          id: 'c2_accept_terms',
          text: '"Shart manzoor hai Akshara. Tumhara aatmasamman mere liye bhi ahem hai."',
          shortLabel: 'Shart manzoor karo',
          keywords: ['manzoor', 'shart', 'aatmasamman', 'sign'],
          next: 's3_akshara_reaction',
          effects: {
            relationships: { akshara: 10 },
            memory: ['{{playerName}} ne Akshara ki shart ko sar-aankhon par manzoor kiya.']
          }
        },
        {
          id: 'c2_add_personal_respect',
          text: '"Hum contract partners hain, par is ghar mein tum kisi se kam nahi rahogi."',
          shortLabel: 'Barabari ka darja',
          keywords: ['barabari', 'kam nahi', 'ghar', 'dignity'],
          next: 's3_akshara_reaction',
          effects: {
            relationships: { akshara: 8 },
            memory: ['{{playerName}} ne Akshara ko ghar mein barabari ka haq diya.']
          }
        }
      ]
    },
    {
      id: 's3_akshara_reaction',
      title: 'Akshara Ka Faisla: Haan Ya Na',
      narration: [
        '*Cabin mein gehri khamoshi hai. Bahar Dilli ki shaam dhal rahi hai.*',
        '*Akshara kaanpte haathon se pen uthati hai. Uski ankhon mein behen ke bachte hue chehre ki tasveer aati hai.*',
        'Akshara: "Main haan kehti hoon, {{playerName}} sir. Apni behen ke liye main yeh rishta nibhaungi. Lekin kripya... mujhe kabhi be-izzat mat kijiyega."',
        '*Usne contract ke aakhri panne par apna signature kar diya: "Akshara Sharma".*',
        '*Usi waqt cabin ka darwaza khulta hai. Ruchika bhabhi andar dakhil hoti hain, unke tewar behad strict hain.*',
        'Ruchika: "{{playerName}}! Board members meeting ke liye wait kar rahe hain... aur yeh ladki kaun hai tumhare cabin mein?"'
      ],
      fallbackLines: [
        '*Ruchika bhabhi ki tez nazrein Akshara par ghoomti hain.*',
        'Ruchika: "Kuch jawab doge ya main security bulaun?"'
      ],
      choices: [
        {
          id: 'c3_introduce_fiancee',
          text: 'Akshara ka haath thaam kar seedha Bhabhi se kaho — "Bhabhi, yeh Akshara hain. Meri hone wali patni."',
          shortLabel: 'Patni declare karo',
          keywords: ['bhabhi', 'patni', 'akshara', 'haath'],
          next: 's4_ruchika_meeting',
          effects: {
            relationships: { akshara: 10, ruchika: 5 },
            flags: { declaredToRuchika: true },
            memory: ['{{playerName}} ne pehle hi pal Akshara ka haath thaam kar Ruchika bhabhi ke samne use apni patni declare kar diya.']
          }
        },
        {
          id: 'c3_diplomatic_cover',
          text: 'Dheere se Bhabhi ko side mein le jakar shaant karo aur planning batao',
          shortLabel: 'Diplomatic baat karo',
          keywords: ['diplomatic', 'planning', 'side', 'shaant'],
          next: 's4_ruchika_meeting',
          effects: {
            relationships: { ruchika: 7, akshara: 4 },
            memory: ['{{playerName}} ne Ruchika bhabhi ko situation diplomatically samjhayi.']
          }
        }
      ]
    },
    {
      id: 's4_ruchika_meeting',
      title: 'Bhabhi Ka Shaq Aur Pariksha',
      narration: [
        '*Ruchika bhabhi ki aankhein hairani se badi ho jaati hain. Woh Akshara ki taraf dekhti hain — saadgi, bina kisi designer jewellery ke, par ankhon mein ek anokhi shaan.*',
        'Ruchika: "Shaadi? Kal tak tumhare paas koi ladki nahi thi aur aaj achanak tumhari employee tumhari fiancee ban gayi?"',
        '*Akshara ghabraati nahi hai. Woh aage aakar Ruchika bhabhi ke pair chhooti hai.*',
        'Akshara: "Namaste Bhabhi ji. Main jaanti hoon yeh achanak hai, par hum dono ek doosre ki izzat karte hain."',
        '*Ruchika bhabhi ke chehre par halki si narm kashish aati hai, halanki shaq abhi khatam nahi hua.*',
        'Ruchika: "Theek hai. Agar sach hai, toh kal raat Sharma family gala dinner mein sabke samne formal engagement hogi."'
      ],
      fallbackLines: [
        '*Ruchika bhabhi apne bag ko theek karti hain.*',
        'Ruchika: "Agar yeh koi drama nikla {{playerName}}, toh consequences bohot bure honge."'
      ],
      choices: [
        {
          id: 'c4_accept_gala_challenge',
          text: '"Humein manzoor hai Bhabhi. Kal raat poora parivar Akshara ka aadar karega."',
          shortLabel: 'Challenge manzoor',
          keywords: ['gala', 'manzoor', 'engagement', 'bhabhi'],
          next: 's5_first_public_appearance',
          effects: {
            relationships: { akshara: 8, ruchika: 6 },
            memory: ['{{playerName}} ne gala dinner mein engagement challenge accept kiya.']
          }
        },
        {
          id: 'c4_comfort_akshara_after',
          text: 'Bhabhi ke jaane ke baad Akshara ko hosla do — "Ghabrao mat, main hamesha tumhare sath khada rahunga."',
          shortLabel: 'Akshara ko hosla do',
          keywords: ['hosla', 'akshara', 'ghabrao mat', 'saath'],
          next: 's5_first_public_appearance',
          effects: {
            relationships: { akshara: 10 },
            memory: ['{{playerName}} ne Akshara ko akele mein poora hosla aur sahara diya.']
          }
        }
      ]
    },
    {
      id: 's5_first_public_appearance',
      title: 'Penthouse Ki Khamoshi Aur Naya Rishta',
      narration: [
        '*Raat ko South Delhi ke penthouse ki terrace par thandi hawa chal rahi hai. Akshara balcony ki railing ke paas khadi sheher ki lights dekh rahi hai.*',
        '*Uske haath mein contract ki copy hai, par ankhon mein ek naya ehsaas — darr ke peeche chhupe kisi naram bharose ka ehsaas.*',
        'Akshara: "{{playerName}}... kya sach mein hum dono is safar ko nibha payenge? Yeh jhooth sach jaisa lagne laga hai."',
        '*Tum uske bagal mein aakar khade hote ho. Kaagaz ka rishta ab dilon ki taraf mud raha hai.*',
        '*Yeh kahani yahan rukti nahi — kal ka gala dinner, media ki cameras, parivarik sazish aur dabi hui mohabbat ke naye toofan intezaar kar rahe hain.*'
      ],
      fallbackLines: [
        '*Dilli ki raat mein terrace par hawa sansana rahi hai.*',
        '*Akshara ki palke tumhari aawaz par uthti hain.*'
      ],
      choices: [
        {
          id: 'c5_reassure_future',
          text: '"Jab tak hum dono ek doosre ka sath denge, koi toofan hume hila nahi sakta, Akshara."',
          shortLabel: 'Sath ka wada karo',
          keywords: ['wada', 'toofan', 'saath', 'akshara'],
          next: 's1_boardroom_ultimatum',
          effects: {
            relationships: { akshara: 7 },
            memory: ['{{playerName}} ne Akshara ko sath nibhane ka saccha wada kiya.']
          }
        },
        {
          id: 'c5_prepare_for_gala',
          text: '"Chalo aaram karo, kal poore sheher ko batana hai ki tum meri patni ho."',
          shortLabel: 'Kal ki tayyari karo',
          keywords: ['aaram', 'kal', 'patni', 'gala'],
          next: 's1_boardroom_ultimatum',
          effects: {
            relationships: { akshara: 6 },
            memory: ['{{playerName}} ne gala dinner ke liye tayyari karne ko kaha.']
          }
        }
      ]
    }
  ]
};
