from schema import P, C, S

PART = P(
    "Safety Aur Apna Recovery Map",
    "Pehle risk ko samjho, phir speed badhao",
    "02-safety.jpg",
    "Kuch situations mein self-help exercises useful first step hain; kuch mein medical assessment sabse urgent first step hai. Yeh part tumhe red flags, treatment options aur appointment preparation dega. Iska purpose fear create karna nahi — unsafe solo attempt se bachana hai.",
    C(
        4,
        "Withdrawal Safety: Kab Home Plan Nahi Chahiye",
        "Alcohol, sedatives, opioids aur mixed use mein different risks",
        S(
            "Sabse pehla rule: abrupt stop har case mein brave nahi",
            "Internet par ‘bas band kar do’ advice strong lagti hai, lekin heavy prolonged alcohol use ya sedative/CNS-depressant dependence mein abrupt stopping dangerous ho sakti hai. Alcohol withdrawal mein tremors, sweating, nausea, anxiety, insomnia, raised pulse/BP, seizures aur delirium tremens jaise severe complications possible hain. Benzodiazepines aur similar sedatives ki withdrawal bhi severe, potentially life-threatening ho sakti hai. Isliye in situations mein book-based taper ya cold-turkey challenge dena safe nahi.",
            "Safe plan doctor ke saath banta hai, jismein substance, amount, duration, last use, previous withdrawals, other medicines, mental/physical health aur home support discuss hota hai. Clinician outpatient monitoring, inpatient detox, medication ya gradual supervised approach mein se kuch recommend kar sakta hai. Tumhara job apne aap dose design karna nahi; honest information dena aur prescribed plan follow karna hai. Agar access ya cost issue hai, government hospital/de-addiction service aur helpline se options poochho.",
            callout=("Red-line rule", "Heavy alcohol use, sedative dependence, previous withdrawal seizure/DT, mixed depressant use, pregnancy, serious medical illness, ya previous severe withdrawal ho toh solo abrupt cessation attempt mat karo. Urgent qualified assessment lo."),
        ),
        S(
            "Emergency signs ko ‘normal withdrawal’ mat samjho",
            "Seizure, hallucinations, severe confusion, extreme agitation, fainting, new severe headache, chest pain, blue/pale lips, very slow/irregular breathing, unresponsiveness, severe vomiting with inability to keep fluids, serious injury, ya suicidal/violent behaviour — inmein immediate emergency help chahiye. India mein 112 call karo ya nearest emergency department. Agar kisi substance ke baad person react nahi kar raha, breathing abnormal hai, ya collapse hua hai, toh time waste mat karo. ‘Sula do, khud theek ho jayega’ dangerous assumption ho sakti hai.",
            "Emergency wait karte hue person ko alone chhodna, force-feed karna, forced vomiting, cold shower, more substances dena, ya unknown home remedy dena avoid karo. Operator ke instructions follow karo. Agar person safe position mein place karna possible hai aur breathing concern hai, toh emergency dispatcher guide karega; unnecessary physical restraint mat do. Substance/medicine name, approximate amount, time, existing conditions aur current symptoms clearly batao. Information chhupana treatment delay kar sakta hai.",
            bullets=["Call: 112 / nearest emergency service.", "Tell: kya liya, kitna estimate, kab, aur kaunsi medicines/conditions.", "Avoid: driving the person yourself while severely impaired, if emergency transport is available.", "Stay: safe distance se observe; dispatcher instructions follow karo.", "Do not: more alcohol/drugs, random sedatives, vomiting, cold shower ya punishment."],
        ),
        S(
            "Substance-specific safety snapshot",
            "Alcohol aur sedatives mein medically supervised withdrawal planning especially important hai. Opioid withdrawal aksar intensely uncomfortable hota hai, aur professional treatment cravings, withdrawal aur long-term retention mein help kar sakta hai. Opioid-use disorder mein buprenorphine, methadone aur naltrexone evidence-based options hain, lekin selection/timing clinician decide karta hai. Naltrexone ko current opioid use ke context mein galat time par lena precipitated withdrawal kar sakta hai; isliye self-start nahi.",
            "Cannabis aur stimulants ke liye behavioural therapies central hain; sleep, mood, anxiety, paranoia, agitation ya psychosis jaisi symptoms ho toh assessment chahiye. Inhalants sudden severe medical harm kar sakte hain; chest symptoms, collapse ya confusion emergency hai. Mixed substances — especially alcohol, opioids aur sedatives ka combination — breathing/overdose risk ko complicated kar sakte hain. Har additional substance assessment ka part hai, side detail nahi. ‘Bas thoda sa’ bhi clinician ko batana useful hai.",
            bullets=["Alcohol/sedatives: abrupt stop can be dangerous; supervised plan.", "Opioids: effective medication exists; overdose and reduced-tolerance risk matter.", "Tobacco/nicotine: behavioural support + appropriate medication options; quitline helpful.", "Cannabis/stimulants: behavioural care; severe mental/physical symptoms need assessment.", "Inhalants/mixed use: unpredictable medical risk; emergency signs taken seriously."],
        ),
        S(
            "Appointment tak ka safe holding plan",
            "Agar withdrawal risk possible hai lekin current emergency symptoms nahi hain, toh appointment book karke wait karna alone plan nahi hona chahiye. Same-day ya earliest medical advice lo, trusted adult ko informed rakho, driving/operating machinery avoid karo, aur substances/medicines ko apne aap add/remove mat karo. Doctor jab tak clear instruction na de, internet ka taper follow mat karo. Agar symptoms escalate hon, toh appointment date ka wait nahi — emergency care.",
            "Holding plan mein practical environment bhi hai: easy access to unknown substances kam karo, using alone avoid karo, unsafe people/places se distance, regular food/hydration as tolerated, aur emergency numbers visible. Yeh steps overdose-proof nahi hain, lekin risk kam kar sakte hain. Agar tum already prescribed medication le rahe ho, toh prescriber ko exact current use batao. Family member ko instruction do ki shame ya physical punishment nahi karna; agitated person ko provoke karna safety worsen kar sakta hai.",
            exercise=("Safe holding card", ["Doctor/service ka naam aur appointment time.", "Trusted person ka naam, phone aur role.", "112 aur nearest emergency department location.", "Substances/medicines ki honest list aur last-use time.", "Kaunse symptoms par hum wait nahi karenge?"]),
        ),
        S(
            "Lapse ke baad tolerance aur overdose risk",
            "Abstinence ya reduced use ke period ke baad body ki tolerance kam ho sakti hai, especially opioids mein. Agar person purani quantity par wapas chala jaaye, toh overdose risk badh sakta hai. Isliye lapse ke baad ‘ab toh sab khatam’ kehkar heavy use karna medically dangerous ho sakta hai. Safe reset ka pehla step immediate risk assess karna hai: current intoxication, breathing, consciousness, mixed substances, chest symptoms, severe agitation, ya injury? Emergency signs ho toh 112.",
            "Non-emergency lapse mein bhi clinician ko early inform karna useful hai, particularly prescribed naltrexone, buprenorphine, methadone, disulfiram, sedatives ya other medicines involved hon. Medication ko restart/stop karne ka instruction generic nahi hona chahiye; substance, last use aur treatment history matter karte hain. ‘Main phir se start karunga Monday ko’ delay plan na ho. Same-day support call, safe environment aur next appointment lapse ko extended return-to-use mein convert hone se rok sakte hain.",
            callout=("Never chase the lapse", "Ek episode ke baad punishment, more substance, double medication, starvation, excessive exercise ya risky ‘proof of control’ mat karo. Safety → honest information → professional/support contact → revised plan."),
        ),
        S(
            "Jab mental health ya special situation involved ho",
            "Suicidal thoughts, self-harm, hallucinations, severe depression, mania-like symptoms, panic with inability to stay safe, ya violence risk ho toh addiction plan ke saath urgent mental-health support chahiye. Tele-MANAS 14416 / 1800-891-4416 se support/referral mil sakta hai; immediate danger mein 112. Agar koi aur person risk mein hai, toh uski safety priority hai. Substance intoxication ke time major decisions, driving, arguments ya sexual activity involving impaired consent avoid karo.",
            "Pregnancy, breastfeeding, under-18 age, older age, liver/kidney/heart disease, seizure history, eating disorder, chronic pain, previous severe withdrawal, ya multiple medications ho toh plan specialist input ke bina copy mat karo. In contexts mein ‘general advice’ insufficient ho sakti hai. Iska matlab recovery impossible nahi — matlab personalised care zyada important hai. Correct treatment available hai, aur early disclosure unnecessary complications se bacha sakti hai.",
            bullets=["Immediate danger/self-harm: 112 or emergency department.", "Mental-health support/referral: Tele-MANAS 14416 / 1800-891-4416.", "Substance treatment navigation: National Drug-de-Addiction Helpline 14446.", "Tobacco support: National Tobacco Quitline 1800-11-2356."],
        ),
        S(
            "One-page safety plan",
            "Ab ek page par apna safety plan likho, lekin sensitive information ko secure rakho. Usmein emergency signs, contacts, current substances/medicines, allergies, major conditions, trusted person aur nearest facility ho. Agar shared home mein privacy concern hai, toh clinician ke saath safe storage discuss karo. Plan ko phone lock-screen par detailed sexual/substance history ke bina rakho; sirf emergency contacts aur action sequence enough hai.",
            "Safety plan ko trusted person ke saath rehearse karo: ‘Agar main unresponsive hoon, toh 112; agar main sirf craving mein hoon, toh yeh alternative contact.’ Dono situations ko same response dena useful nahi. Family/friends ko bhi clear karo ki punishment, forced detox, tying/restraining, withholding prescribed medicine, ya public shame safe treatment nahi. Qualified, humane care hi plan hai.",
            exercise=("My safety sequence", ["RED: emergency signs → 112 / emergency department.", "AMBER: possible dependence or repeated loss of control → same-day professional advice.", "GREEN: stable urge, no medical red flags → pause, support person, alternate action.", "After any event: facts record, prescribed instructions follow, plan review."]),
        ),
        refs=["R13", "R14", "R15", "R16", "R17", "R19", "R20", "R21", "R22"],
    ),
    C(
        5,
        "Baseline, Assessment Aur Professional Help",
        "Doctor/therapist ke saath better conversation, better plan",
        S(
            "Assessment ka goal label nahi, formulation hai",
            "Good assessment sirf ‘addiction hai ya nahi’ ka yes/no nahi hoti. Clinician pattern, severity, duration, triggers, previous attempts, withdrawal risk, physical health, mental health, medications, relationships, work/study, safety aur available support samajhta hai. CSBD assessment mein high desire, moral distress, actual impaired control, other conditions aur functional impact differentiate kiye jaate hain. Substance assessment mein substance-specific risks aur treatment needs central hote hain.",
            "Isliye one-minute online quiz ko final verdict mat samjho. Screening tool useful ho sakta hai, lekin diagnosis aur plan qualified conversation se banta hai. Tum apne notes se clinician ka kaam easy kar sakte ho: approximate amounts/frequency, last use, consequences, previous treatment, current medications, allergies, medical history, and what you want to change. Agar exact number yaad nahi, honest estimate bolo; guessing ko fact mat banao.",
            callout=("Useful opening line", "‘Maine pattern ko privately control karne ki koshish ki hai, ab main safe assessment chahta hoon. Mera main concern ___ hai, aur mere saath ___ bhi ho raha hai.’"),
        ),
        S(
            "Kaunsa professional kis role mein?",
            "Physician/general practitioner initial health assessment, withdrawal risk, physical complications, medication review aur referral mein help kar sakte hain. Psychiatrist substance-use disorders, mental-health conditions, medication aur complex presentations assess karte hain. Clinical psychologist/trained psychotherapist CBT, motivational work, ACT aur relapse-prevention skills de sakte hain. Sexual-medicine specialist ya qualified sex therapist sexual-health concerns, functioning, relationships aur CSBD assessment mein useful ho sakte hain. De-addiction centres multidisciplinary support provide kar sakte hain.",
            "India mein government hospital, medical college, district de-addiction services, NAPDDR-linked centres, NIMHANS/other addiction services aur qualified private professionals options ho sakte hain. National Drug-de-Addiction Helpline 14446 navigation ke liye use karo. Kisi centre ko choose karne se pehle humane care, qualified staff, medical support, consent, privacy, aftercare, charges aur emergency protocol poochho. Forced labour, violence, public humiliation, unlawful confinement ya miracle cure claims red flags hain.",
            bullets=["Credentials aur experience kya hai?", "Medical withdrawal support available hai ya referral hota hai?", "Treatment plan aur review schedule kya hoga?", "Consent, privacy aur family involvement kaise handle hoga?", "Aftercare, relapse support aur total cost kya hai?"],
        ),
        S(
            "Outpatient, intensive ya residential?",
            "Outpatient care mein person home rehkar appointments, therapy, medication review aur support groups attend karta hai. Stable home, manageable withdrawal risk, reliable transport/support aur ability to stay safe is format ko practical banate hain. Intensive outpatient/day programmes zyada structure dete hain. Residential/inpatient care severe medical risk, unsafe environment, repeated unsuccessful outpatient attempts, complex mental-health needs, ya 24-hour monitoring requirement mein consider hota hai.",
            "More expensive ya more restrictive automatically better nahi. NIDA treatment ko individual needs ke hisaab se tailor karne par stress karta hai. Residential discharge ke baad bhi continuing care zaroori hai; ‘28 days ho gaye, ab permanent cure’ expectation unsafe hai. CSBD mein bhi setting severity, safety, co-occurring conditions aur functioning par depend karti hai. Decision clinician ke saath lo, aur centre se written plan maango: goals, services, medication policy, family contact, discharge aur follow-up.",
            callout=("Good question", "‘Is level of care ko mere case mein kyun recommend kar rahe hain? Agar main outpatient start karoon, toh kin signs par higher support chahiye hoga?’"),
        ),
        S(
            "Therapies ka practical meaning",
            "Cognitive behavioural therapy cues, thoughts, emotions aur behaviours ke links identify karke alternative responses practise karti hai. Motivational interviewing change ke apne reasons strengthen karti hai, argument ya shame se nahi. Contingency management healthy target behaviours ko structured positive reinforcement deta hai; stimulant-use disorders mein especially strong evidence hai. Family/couples work communication, boundaries aur support improve kar sakta hai. Mutual-support groups social support de sakte hain, lekin woh medical treatment ka substitute nahi.",
            "CSBD/PPU mein CBT-based interventions ka emerging evidence hai; ACT, mindfulness-based relapse prevention aur motivational components bhi studies mein aaye hain. Research quality aur sample diversity limited hai, isliye ‘guaranteed method’ claim avoid karo. Therapist se poochho: ‘Mere case formulation kya hai? Kaunse skills practise hongi? Progress kaise review hoga? Agar yeh approach kaam na kare toh next option kya?’ Good therapy collaborative hoti hai, humiliating nahi.",
            bullets=["CBT: trigger-thought-action-result mapping and practice.", "Motivational work: ambivalence ko explore karke own reasons for change.", "Contingency management: positive targets and structured reinforcement.", "Mindfulness/ACT: urges ko observe, values-based action choose karna.", "Support groups: connection and accountability, alongside—not instead of—needed medical care."],
        ),
        S(
            "Medication se fear bhi nahi, self-prescription bhi nahi",
            "Kuch substance-use disorders ke liye effective medications available hain. Opioid-use disorder mein buprenorphine, methadone aur naltrexone; alcohol-use disorder mein naltrexone, acamprosate aur disulfiram; tobacco cessation mein NRT, varenicline, bupropion aur cytisine jaise options different regions/approvals mein use hote hain. Correct option health, other medicines, current use, pregnancy, mental health, previous response aur patient preference par depend karta hai. Dose/timing book se decide nahi hota.",
            "CSBD mein koi universal ‘anti-addiction pill’ nahi. SSRIs, naltrexone ya other medicines ko specialists selected cases/co-occurring conditions mein consider kar sakte hain, often off-label, aur evidence limited/developing hai. Internet se sleeping pills, anti-anxiety medication, hormones, ‘testosterone boosters’, herbal detox, ya someone else’s prescription lena risk create kar sakta hai. Agar medicine side effects de, toh abruptly stop karne ke bajay prescriber se urgent guidance lo, unless emergency advice says otherwise.",
            callout=("Medication conversation", "‘Is medicine ka goal kya hai? Common and serious side effects kya hain? Alcohol/other substances ke saath interaction? Missed dose/lapse par kya karna hai? Review kab hoga? Stop/taper kaise decide hoga?’"),
        ),
        S(
            "Privacy aur honest disclosure ko balance karo",
            "Shame ki wajah se log amount kam batate, second substance chhupate, ya sexual behaviour ka important part omit karte hain. Isse withdrawal/medication risks miss ho sakte hain. Appointment se pehle confidentiality policy poochho: information kaun access karega, family ko kya bataya jayega, records kaise store honge, aur safety emergency mein disclosure kis had tak required hoga. Exact legal/policy details region/provider se vary kar sakte hain, isliye assumptions na rakho.",
            "Agar family involve karni hai, toh consent ke saath roles define karo: appointment reminder, safe transport, emergency recognition, removing access, ya simply non-judgemental listening. Family ko password control, invasive monitoring, physical punishment, forced public disclosure, ya medication control without clinical guidance nahi dena. Partner/family support respectful hona chahiye. Minor ho toh trusted adult aur age-appropriate qualified care important hai; unsafe adult ko confidant choose karna zaroori nahi.",
            bullets=["Share: facts needed for safety and treatment.", "Ask: confidentiality and its limits.", "Choose: who gets what information, where possible.", "Avoid: surveillance, threats, shame, and forced treatment details shared publicly."],
        ),
        S(
            "Appointment-ready one-page summary",
            "Ek single page prepare karo jise tum clinician ko dikha sako. Top par main concern; phir pattern and duration; substances/medicines; withdrawal/previous severe events; mental/physical health; concrete impacts; previous attempts; current support; and your goal. Sexual behaviour section mein non-graphic functional description enough hai. Illegality ya another person’s safety involved ho toh hide mat karo; clinician ko risk assess karna zaroori hai.",
            "Appointment ke end par next steps repeat karke confirm karo: medicine hai toh kya, next visit kab, danger signs kya, emergency contact kaun, family ka role kya, aur lapse ho toh kya karna hai. Agar tumhe plan samajh nahi aaya, toh ‘thoda simple words mein phir se bolenge?’ kehna perfectly okay hai. Good recovery plan woh hai jo tum real life mein explain aur follow kar sako, fancy terminology nahi.",
            exercise=("My one-page brief", ["Main concern + desired change.", "Pattern: type, approximate amount/frequency, duration, last episode/use.", "Risks: withdrawal, medical, psychiatric, relationship/consent/safety.", "Current medicines, allergies, conditions, previous treatment.", "Next steps, warning signs, contacts and review date — clinician ke saath confirm."]),
        ),
        refs=["R3", "R4", "R7", "R8", "R10", "R11", "R13", "R14", "R16", "R17", "R18", "R20", "R24", "R25", "R26"],
    ),
)
