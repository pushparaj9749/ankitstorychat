from schema import P, C, S

PART = P(
    "Urge Aur Emotion Toolkit",
    "Small skills, repeated in real moments",
    "06-urge-surfing.jpg",
    "Skills tab kaam karti hain jab woh moment mein yaad aur accessible hon. Isliye yahan long theory ke bajay short, testable tools hain. Kisi ek tool ke fail hone ka matlab recovery fail nahi; next layer choose karo.",
    C(
        13,
        "Craving Toolbox: Pause Se Next Action Tak",
        "Wave ko observe karo, automatic action ko interrupt karo",
        S(
            "Urge ka clock nahi, process dekho",
            "Log aksar ‘craving exactly 90 seconds ya ten minutes mein khatam hoti hai’ jaise fixed rules quote karte hain. Real experience variable hai: kuch waves seconds mein shift hoti hain, kuch return karti hain, kuch withdrawal/mental-health condition ke saath longer rehti hain. Timer useful ho sakta hai, lekin guarantee nahi. Better goal: urge ko notice karna, unsafe action postpone karna, support add karna, and next review karna — regardless of exact duration.",
            "Craving intensity 0–10 se note karna optional hai, not compulsory. Numbers par obsess na karo. Urge high ho toh simple action; moderate ho toh thought record; low ho toh prevention. If severe withdrawal or medical symptoms accompany craving, treat it as health issue, not only a wave. ‘Surfing’ should never delay seizure, confusion, breathing difficulty or overdose response.",
            callout=("Success definition", "Success = urge ke saath bhi safe choice ya early help. Success ≠ urge ka immediately disappear hona."),
        ),
        S(
            "Grounding: present ko five senses se anchor karo",
            "Feet floor par, surroundings ko name karo: five visible objects, four sounds, three physical sensations, two smells, one taste — count ko rigid mat banao, sensory attention is the point. Cool water on hands, holding a cup, feeling chair support, or stepping into fresh air can help. Choose senses comfortable for you; trauma survivors may find some body-focused practices distressing, so external grounding is an option.",
            "Grounding ke baad immediately next safe action karo, otherwise same trigger environment mein attention wapas ja sakti hai. Example: ground → phone away → shared space → message support. Grounding ko test karo when calm, so it is not a strange new technique during crisis. If dizziness, panic or discomfort increases, stop and choose another method or professional guidance.",
            exercise=("Pocket grounding", ["Name where you are and today’s date.", "Notice three neutral things around you.", "Feel one supportive surface.", "Say: ‘Main current moment mein safe next step choose kar sakta hoon.’", "Move to your preselected next action."]),
        ),
        S(
            "Breathing: gentle, not forced",
            "Breathing exercise ka goal big deep breaths lena nahi; comfortable, slightly slower exhale and reduced rushing ho sakta hai. Try relaxed posture, inhale normally, exhale gently without straining, for a few cycles. If you have respiratory/cardiac issues, feel dizzy, or breath focus increases panic, stop. No breath-holding challenges or hyperventilation. Grounding through sounds or movement may suit you better.",
            "Breathing craving ko magically erase nahi karegi. It can lower physiological urgency enough to remember your next step. Pair it with a sentence: ‘Exhale; decision abhi automatic nahi.’ Then follow the environment/support plan. If breathing difficulty is new, severe, substance-linked, or accompanied by blue lips/unresponsiveness, it is not a coping exercise situation — call emergency services.",
            bullets=["Comfortable posture; no force.", "Normal inhale, gentle unforced exhale.", "Stop if dizzy or more panicked.", "Use as bridge to action, not entire plan.", "New/severe breathing symptoms = medical help."],
        ),
        S(
            "Movement aur daily activity",
            "WHO adults ke liye regular aerobic and muscle-strengthening activity recommend karta hai for general health, but recovery mein start point individual health/ability par depend karega. You do not need an intense workout to prove commitment. A brief walk, gentle stretching, household task, or clinician-approved activity can change context and reduce idle cue exposure. Persistent exhaustion, pain, dizziness, eating disorder, or medical condition ho toh personalised advice lo.",
            "Movement ko punishment mat banao: ‘lapse hua, ab 100 push-ups’ shame loop ko reinforce karta hai. Also avoid replacing one compulsion with exercise compulsion. Goal sustainable rhythm and broader life, not exhaustion. Start below your maximum, increase gradually, hydrate as appropriate, and stop for concerning symptoms. Physical activity adjunct hai; substance-use disorder or CSBD ka stand-alone cure nahi.",
            exercise=("Gentle activity menu", ["One two-minute option for high-urge moments.", "One ten-minute option for daily routine.", "One social/outdoor option you value.", "Health adaptations or clinician questions.", "Signs to stop and seek help."]),
        ),
        S(
            "Thought record: courtroom nahi, curiosity",
            "Thought record mein situation, automatic thought, emotion, evidence for/against, balanced alternative and next action hote hain. Aim automatic thought ko legally prove wrong karna nahi, uski certainty ko loosen karna hai. ‘Main ek lapse ke baad hopeless hoon’ ke against evidence: previous return-to-plan, current support, available appointment. Balanced thought: ‘Lapse serious ho sakta hai, lekin main abhi escalation rok sakta hoon aur help le sakta hoon.’",
            "Avoid toxic positivity. ‘Sab perfect hai’ false hai. Balanced thought difficult reality ko acknowledge karta hai and action option include karta hai. If thoughts involve self-harm, worthlessness with inability to stay safe, paranoia, hallucinations or mania, simple thought record alone insufficient. Urgent mental-health support lo. CBT tools are helpful within the right level of care.",
            bullets=["Automatic thought exactly what?", "What emotion and urge followed?", "What facts support it? What facts complicate it?", "What is a balanced, believable alternative?", "What safe action follows now?"],
        ),
        S(
            "Opposite action: emotion ke opposite nahi, compulsion ke opposite",
            "Opposite action ka matlab valid emotion ko deny karna nahi. Anger feel kar sakte ho without aggressive/use behaviour; loneliness feel kar sakte ho without compulsive escape; shame feel kar sakte ho without hiding from clinician. Action choose karo jo long-term value serve kare: urge to isolate → brief safe contact; urge to seek substance → leave access and call support; urge to scroll → device away and start defined task.",
            "First action small enough to do while emotion is high. ‘I will rebuild my whole life today’ is not opposite action; it is overwhelm. ‘I will send one honest text’ is. If safety risk exists, opposite action may be leaving the situation, asking for urgent help, or not engaging in conflict. Your values guide the action, not a demand to feel cheerful.",
            callout=("Ask", "‘Agar main is feeling ko bina harmful behaviour ke honour karoon, toh next two minutes ka action kya hoga?’"),
        ),
        S(
            "Coping card ko test aur revise karo",
            "Coping card wallet/phone mein ho sakti hai, but sensitive details avoid karo. Front: top trigger, warning thought, three actions, two contacts. Back: emergency signs and 112, values reminder, professional appointment. Keep wording brief. Test the card once in a low-stress moment: can you find it, read it, and do the first step? If not, simplify or move it.",
            "After real use, mark what happened. Did action take too long? Contact unavailable? Location unsafe? Update. A coping plan is a prototype, not a sacred contract. Share appropriate parts with clinician/support person so they can help you use it. The card should make safe action easier under stress; anything decorative but unusable can go.",
            exercise=("My coping card", ["Warning sign: ___", "Permission thought: ___", "First two-minute action: ___", "Backup action/location: ___", "Contacts + emergency escalation: ___", "One values-based sentence: ___"]),
        ),
        refs=["R4", "R5", "R10", "R11", "R17", "R21", "R22", "R23", "R24"],
    ),
    C(
        14,
        "Stress, Loneliness, Sleep Aur Mental Health",
        "Underlying pressure ko treat kiye bina recovery incomplete lagti hai",
        S(
            "Stress ko life se delete nahi, capacity se meet karna hai",
            "Stressful events recovery ke baad bhi aayenge. Goal zero stress nahi; predictable load, recovery breaks, support and problem-solving. Stress ko controllable vs not-currently-controllable mein divide karo. Deadline ko tasks mein break kar sakte ho; someone else’s reaction ko fully control nahi. First category mein action, second mein acceptance, boundaries and support. Both categories mein old substance/compulsion route ko default mat rehne do.",
            "Daily ‘minimum viable day’ banao for high-stress periods: prescribed treatment, one necessary task, food/hydration as appropriate, one support contact, basic hygiene, and safe wind-down. Extra goals temporarily reduce karo. This is not giving up; it is protecting the essentials. If stress comes with inability to function, severe panic, persistent depression, or suicidal thoughts, professional assessment is needed.",
            exercise=("Stress triage", ["What is within my control today?", "What needs acceptance or boundary rather than more effort?", "What is the one necessary task?", "Who can share the load?", "What is my minimum safe routine tonight?"]),
        ),
        S(
            "Loneliness ko instant intimacy se solve mat karo",
            "Loneliness ek signal ho sakta hai ki connection, belonging or being understood ki need hai. Substance/use communities or compulsive sexual behaviour briefly contact/escape de sakte hain, but not necessarily safe connection. Build a ladder: low-pressure contact, regular activity, peer/professional group, deeper friendship, therapy. One person par entire emotional load rakhna relationship ko strain kar sakta hai; multiple safe supports better.",
            "Connection ka first step ordinary ho sakta hai: neighbour ko hello, classmate se notes, support meeting, family member ke saath tea, community volunteering. Online communities use karo with privacy and boundaries; explicit/triggering spaces avoid. If social anxiety severe hai, gradual practice and therapy help kar sakte hain. Loneliness aapse koi defect prove nahi karti; it is a human need requiring repeated safe contact.",
            bullets=["One low-pressure contact today.", "One recurring weekly activity.", "One professional/peer support option.", "One person for deeper conversation when ready.", "One boundary to keep online connection safe."],
        ),
        S(
            "Boredom aur empty calendar",
            "Early recovery mein time unexpectedly empty lag sakta hai, especially jab behaviour hours consume karta tha. Us gap ko immediately productive optimisation se bhar dena unnecessary pressure hai. Mix rest, pleasure, mastery and connection. Rest: quiet break. Pleasure: music, safe hobby. Mastery: small task. Connection: person/community. Different rewards build a life that does not rely on one intense behaviour.",
            "Choose activities based on actual preference, not what looks impressive. If you do not know what you enjoy, experiment in short blocks without commitment. Avoid high-risk versions: bar-based socialising early in alcohol recovery, explicit/triggering entertainment in porn compulsion, or gambling/shopping as replacement compulsion. New behaviour bhi out of control lage toh review karo. Recovery is not transferring the entire cycle to a new object.",
            callout=("Four-slot evening", "Rest + simple meal + one enjoyable/meaningful activity + one connection/check-in. Keep it small enough to repeat."),
        ),
        S(
            "Sleep ko support karo, perfect banane ka pressure nahi",
            "Regular wake time, daylight/movement as appropriate, reduced late-night stimulating content, comfortable sleep environment, and device boundaries can support sleep. Caffeine/nicotine timing and other substances/medicines can affect sleep; individual advice clinician se lo. Alcohol/sedatives ko sleep aid ki tarah self-use karna risky hai, and stopping them abruptly if dependent bhi unsafe. Persistent insomnia ke liye CBT-I or medical assessment useful ho sakta hai.",
            "One bad night ko catastrophe mat banao. ‘Ab main relapse karunga’ permission/anxiety loop create karta hai. Instead next-day plan simplify, support increase, avoid driving if sleepy/impaired, and follow professional advice. If several nights of very little sleep come with unusually high energy, impulsivity, inflated confidence, racing thoughts or sexual disinhibition, urgent mental-health assessment chahiye; it may be more than ordinary insomnia.",
            bullets=["Keep one consistent wake-time anchor where possible.", "Create a low-stimulation wind-down.", "No self-prescribed sleep substances or abrupt medication changes.", "Reduce next-day risks after poor sleep.", "Seek help for persistent, severe or unusual sleep/mood changes."],
        ),
        S(
            "Co-occurring mental-health concerns",
            "Depression, anxiety, PTSD, OCD, ADHD, bipolar disorder, psychosis, eating disorders and other conditions can interact with substance use or compulsive sexual behaviour. Sometimes substance/behaviour is coping; sometimes it worsens symptoms; sometimes both cycles reinforce each other. Sequential ‘pehle addiction perfectly cure, phir mental health’ often unhelpful; integrated assessment better. Clinician ko full symptoms and timeline batao.",
            "Warning signs needing prompt help: persistent inability to function, severe panic, hallucinations, paranoia, mania-like reduced sleep/high energy, self-harm, suicidal thoughts, or risk to others. Tele-MANAS 14416 / 1800-891-4416 support/referral ke liye; immediate danger 112. Emergency services and qualified care ko book exercises se replace mat karo. Treatment for mental health is not a distraction from recovery; often it is recovery infrastructure.",
            callout=("Say it early", "Clinician ko suicidal thoughts, self-harm, hallucinations or risk to another person batana urgent safety information hai. Hide karna recovery ko safer nahi banata."),
        ),
        S(
            "Self-compassion as daily practice",
            "Self-compassion ka simple format: acknowledge difficulty, remember shared humanity, choose responsible kindness. ‘Yeh craving difficult hai; aisa experience many people have; main ab safe step loonga.’ Yeh excuse nahi because safe action included. Avoid global labels. Speak to yourself as you would to someone you are responsibly helping: honest, firm, non-humiliating.",
            "Daily practice can be one sentence after a difficult moment, plus one repair action. If you harmed someone, compassion does not erase accountability or their boundaries. If you feel urges you dislike, you need not hate yourself for having them; actions and support are where responsibility operates. Over time, reduced shame can make honesty and help-seeking easier.",
            exercise=("Three-line reset", ["Difficulty: ‘Is moment mein ___ difficult hai.’", "Common humanity: ‘Struggle ka matlab main alone/defective nahi.’", "Responsible action: ‘Main ab ___ karunga, aur zaroorat ho toh ___ se help lunga.’"]),
            keep_together=True,
        ),
        refs=["R4", "R10", "R11", "R12", "R16", "R17", "R21", "R22", "R23", "R24"],
    ),
)
