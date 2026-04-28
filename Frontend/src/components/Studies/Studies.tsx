import { useState } from 'react';
import './Studies.css';

interface Study {
  title: string;
  authors: string;
  year: number;
  description: string;
  url: string;
  sourceUrl?: string;
  category: string;
}

const studies: Study[] = [
  // Memory & Retention
  {
    category: 'Memory & Retention',
    title: 'Distributed Practice in Verbal Recall Tasks: A Review and Quantitative Synthesis',
    authors: 'Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D.',
    year: 2006,
    description:
      'Spacing out study sessions over time dramatically outperforms massed practice (cramming). This meta-analysis across 839 studies quantifies how much the timing between reviews affects long-term retention, and finds that optimal gaps grow as the test date moves further out.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/16719566/',
  },
  {
    category: 'Memory & Retention',
    title: 'Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention',
    authors: 'Roediger, H. L., & Karpicke, J. D.',
    year: 2006,
    description:
      'Retrieval practice — the act of actively recalling information from memory — improves retention far more than re-reading the same material. Students who took practice tests retained 50% more after a week than those who only restudied.',
    url: 'https://journals.sagepub.com/doi/10.1111/j.1467-9280.2006.01693.x',
  },

  // Focus & Attention
  {
    category: 'Focus & Attention',
    title: 'Sleep-Dependent Memory Consolidation',
    authors: 'Stickgold, R.',
    year: 2005,
    description:
      'Sleep is not passive downtime. During slow-wave and REM sleep, the brain actively replays and consolidates the day\'s learning. This Nature review shows that even partial sleep loss significantly impairs the ability to retain what was studied, undermining hours of effort.',
    url: 'https://www.nature.com/articles/nature04286',
  },
  {
    category: 'Focus & Attention',
    title: 'Give Your Ideas Some Legs: The Positive Effect of Walking on Creative Thinking',
    authors: 'Oppezzo, M., & Schwartz, D. L.',
    year: 2014,
    description:
      'Four experiments show that walking — even on a treadmill facing a blank wall — boosts creative output by an average of 81%. The effect carries over briefly after sitting back down, making short walking breaks a simple, evidence-backed way to restore divergent thinking.',
    url: 'https://psycnet.apa.org/record/2014-14435-001',
  },

  // Environment
  {
    category: 'Environment',
    title: 'Is Noise Always Bad? Exploring the Effects of Ambient Noise on Creative Cognition',
    authors: 'Mehta, R., Zhu, R., & Cheema, A.',
    year: 2012,
    description:
      'A moderate level of ambient noise (~70 dB, similar to a busy coffee shop) enhances creative performance compared to quiet or loud conditions. The subtle distraction from moderate noise increases abstract thinking, while high noise (85 dB) hurts performance across all task types.',
    url: 'https://www.journals.uchicago.edu/doi/10.1086/665048',
  },
  {
    category: 'Environment',
    title: 'The Cognitive Benefits of Interacting with Nature',
    authors: 'Berman, M. G., Jonides, J., & Kaplan, S.',
    year: 2008,
    description:
      'Even brief interactions with natural environments restore directed-attention capacity. Participants who walked in a nature setting improved their memory span by 20% compared to those who walked through city streets. Short nature breaks can meaningfully replenish the focus needed for demanding cognitive work.',
    url: 'https://journals.sagepub.com/doi/10.1111/j.1467-9280.2008.02225.x',
  },

  // Habits & Motivation
  {
    category: 'Habits & Motivation',
    title: 'Be Smart, Exercise Your Heart: Exercise Effects on Brain and Cognition',
    authors: 'Hillman, C. H., Erickson, K. I., & Kramer, A. F.',
    year: 2008,
    description:
      'Regular aerobic exercise increases levels of BDNF (brain-derived neurotrophic factor), promotes hippocampal neurogenesis, and measurably improves attention, memory, and executive function. Even a single bout of moderate exercise produces acute cognitive benefits lasting several hours.',
    url: 'https://www.nature.com/articles/nrn2298',
  },

  // Research papers, used for ai feedback
  {
    title: `Attentive or Not? Toward a Machine Learning Approach to Assessing Students’ Visible Engagement in Classroom Instruction`,
    authors: `Patricia Goldberg`,
    year: 2019,
    description: `Teachers must be able to monitor students ’behavior and identify valid cues in order to draw conclusions about students ’ actual engagement in learning activities. Teacher training can support (inexperienced) teachers in developing these skills by using videotaped teaching to highlight which indicators should be considered. However, this supposes that (a) valid indicators of students ’engagement i`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Attentive or Not_ Toward a Machine Learning Approach to Asse.pdf`,
    sourceUrl: `https://doi.org/10.1007/s10648-019-09514-z`,
    category: `Classroom & Learning`,
  },
  {
    title: `Camera-based Estimation of Student's Attention in Class`,
    authors: `Raca, Mirko`,
    year: 2015,
    description: `Uses a camera-based system to passively estimate student attention during lectures by analyzing facial orientation and body posture, providing a non-intrusive tool for monitoring classroom engagement without wearable sensors.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Camera-based estimation of student_s attention in class.pdf`,
    sourceUrl: `https://doi.org/10.5075/epfl-thesis-6745`,
    category: `Classroom & Learning`,
  },
  {
    title: `Machine Learning applied to student attentiveness detection: Using emotional and non-emotional measures`,
    authors: `Mohamed Elbawab`,
    year: 2023,
    description: `Education and Information Technologies, https://doi.org/10.1007/s10639-023-11814-5`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Machine Learning applied to student attentiveness detection_.pdf`,
    sourceUrl: `https://doi.org/10.1007/s10639-023-11814-5`,
    category: `Classroom & Learning`,
  },
  {
    title: `Predicting Students' Attention in the Classroom From Kinect Facial and Body Features`,
    authors: `Janez Zaletelj`,
    year: 2017,
    description: `EURASIP Journal on Image and Video Processing, 2017, doi:10.1186/s13640-017-0228-8`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Predicting students_ attention in the classroom from Kinect.pdf`,
    sourceUrl: `https://doi.org/10.1186/s13640-017-0228-8`,
    category: `Classroom & Learning`,
  },
  {
    title: `Role of Restorativeness in Improving the Psychological Well-Being of University Students`,
    authors: `Samsilah Roslan`,
    year: 2021,
    description: `Many university students experience high levels of study-related fatigue, hence, necessitating opportunities for restoration.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Role of Restorativeness in Improving the Psychological Well-.pdf`,
    sourceUrl: `https://doi.org/10.3389/fpsyg.2021.646329`,
    category: `Classroom & Learning`,
  },
  {
    title: `A Neuroergonomics Approach to Mental Workload, Engagement and Human Performance`,
    authors: `Frédéric Dehais`,
    year: 2020,
    description: `The assessment and prediction of cognitive performance is a key issue for any discipline concerned with human operators in the context of safety-critical behavior.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/A Neuroergonomics Approach to Mental Workload_ Engagement an.pdf`,
    sourceUrl: `https://doi.org/10.3389/fnins.2020.00268`,
    category: `Cognitive Load & Workload`,
  },
  {
    title: `Cognitive functions and underlying parameters of human brain physiology are associated with chronotype`,
    authors: `Mohammad Ali Salehinejad`,
    year: 2021,
    description: `Shows in a large population study that chronotype — an individual's innate preference for morning or evening activity — is linked to measurable differences in cognitive performance, brain structure, and physiological parameters, underscoring how biological timing shapes mental function.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Cognitive functions and underlying parameters of human brain.pdf`,
    sourceUrl: `https://doi.org/10.1038/s41467-021-24885-0`,
    category: `Cognitive Load & Workload`,
  },
  {
    title: `The Validity of Physiological Measures to Identify Differences in Intrinsic Cognitive Load`,
    authors: `Paul Ayres1, Joy Yeonjoo Lee2, Fred Paas3,4* and Jeroen J. G. van Merriënboer2`,
    year: 2021,
    description: `A sample of 33 experiments was extracted from the Web-of-Science database over a 5-year period (2016–2020) that used physiological measures to measure intrinsic cognitive load.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/The Validity of Physiological Measures to Identify Differenc.pdf`,
    sourceUrl: `https://doi.org/10.3389/fpsyg.2021.702538`,
    category: `Cognitive Load & Workload`,
  },
  {
    title: `A Hybrid Approach to Detect Driver Drowsiness Utilizing Physiological Signals to Improve System Performance and Wearability`,
    authors: `Muhammad Awais, Nasreen Badruddin and Micheal Drieberg`,
    year: 2017,
    description: `Driver drowsiness is a major cause of fatal accidents, injury, and property damage, and has become an area of substantial research attention in recent years. The present study proposes a method to detect drowsiness in drivers which integrates features of electrocardiography (ECG) and electroencephalography (EEG) to improve detection performance.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/A Hybrid Approach to Detect Driver Drowsiness Utilizing Phys.pdf`,
    sourceUrl: `https://doi.org/10.3390/s17091991`,
    category: `Driver Safety & Drowsiness`,
  },
  {
    title: `A Systemic Review of Available Low-Cost EEG Headsets Used for Drowsiness Detection`,
    authors: `Dong-Guk Paeng`,
    year: 2020,
    description: `Drowsiness is a leading cause of traffic and industrial accidents, costing lives and productivity.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/A Systemic Review of Available Low-Cost EEG Headsets Used fo.pdf`,
    sourceUrl: `https://doi.org/10.3389/fninf.2020.553352`,
    category: `Driver Safety & Drowsiness`,
  },
  {
    title: `AR DriveSim: An Immersive Driving Simulator for Augmented Reality Head-Up Display Research`,
    authors: `Joseph L. Gabbard and Bryan Jonas`,
    year: 2019,
    description: `Optical see-through automotive head-up displays (HUDs) are a form of augmented reality (AR) that is quickly gaining penetration into the consumer market.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/AR DriveSim_ An Immersive Driving Simulator for Augmented Re.pdf`,
    sourceUrl: `https://doi.org/10.3389/frobt.2019.00098`,
    category: `Driver Safety & Drowsiness`,
  },
  {
    title: `Driver Drowsiness Classification Using Fuzzy Wavelet Packet Based Feature Extraction Algorithm`,
    authors: ``,
    year: 0,
    description: `Proposes a drowsiness classification approach using fuzzy wavelet-packet analysis to extract discriminative features from physiological signals, achieving reliable separation of alert and drowsy driver states with reduced computational overhead suitable for real-time use.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Driver Drowsiness Classification Using Fuzzy Wavelet-Packet-.pdf`,
    category: `Driver Safety & Drowsiness`,
  },
  {
    title: `Comprehensive study of driver behavior monitoring systems using computer vision and machine learning techniques`,
    authors: `Fangming Qu`,
    year: 2024,
    description: `Journal of Big Data, https://doi.org/10.1186/s40537-024-00890-0`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Comprehensive study of driver behavior monitoring systems us.pdf`,
    sourceUrl: `https://doi.org/10.1186/s40537-024-00890-0`,
    category: `Driver Safety & Drowsiness`,
  },
  {
    title: `Driving performance impairments due to hypovigilance on monotonous roads`,
    authors: `Gregoire S. LARUE, Andry Rakotonirainya, Anthony N. Pettitt`,
    year: 2011,
    description: `Quantifies how hypovigilance — reduced arousal from monotonous highway driving — progressively degrades lane-keeping precision and emergency reaction times, establishing behavioral markers of dangerous inattention that emerge before the driver consciously reports fatigue.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Driving performance impairments due to hypovigilance on mono.pdf`,
    sourceUrl: `https://doi.org/10.1016/j.aap.2011.05.023`,
    category: `Driver Safety & Drowsiness`,
  },
  {
    title: `Gaze Fixation System for the evaluation of Driver Distractions induced by IVIS`,
    authors: `Pedro Jimenez, Luis M. Bergasa, Jesus Nuevo, Noelia Hernandez, Ivan G. Daza`,
    year: 2012,
    description: `Describes a real-time gaze fixation system that classifies driver distraction by measuring where and how long drivers look away from the road, validated against driving performance metrics to enable objective, continuous distraction monitoring.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Gaze Fixation System for the Evaluation of Driver Distractio.pdf`,
    sourceUrl: `https://doi.org/10.1109/tits.2012.2187517`,
    category: `Driver Safety & Drowsiness`,
  },
  {
    title: `Real Time Eye Tracking and Detection- A Driving Assistance System`,
    authors: `Samer AlKork`,
    year: 2018,
    description: `Proposes a real-time eye tracking pipeline for driver assistance that detects drowsiness and inattention by monitoring blink rate, eye closure duration, and gaze deviation, delivering low-latency alerts without requiring dedicated hardware beyond a standard camera.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Real Time Eye Tracking and Detection- A Driving Assistance S.pdf`,
    sourceUrl: `https://doi.org/10.25046/aj030653`,
    category: `Driver Safety & Drowsiness`,
  },
  {
    title: `Stationary gaze entropy predicts lane departure events in sleep-deprived drivers`,
    authors: `Brook A. Shiferaw`,
    year: 2018,
    description: `Demonstrates that stationary gaze entropy — the randomness of a driver's fixation patterns — significantly predicts lane departure events in sleep-deprived drivers, making it a practical, non-intrusive real-time indicator of dangerous fatigue at the wheel.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Stationary gaze entropy predicts lane departure events in sl.pdf`,
    sourceUrl: `https://doi.org/10.1038/s41598-018-20588-7`,
    category: `Driver Safety & Drowsiness`,
  },
  {
    title: `Adaptive Automation Triggered by EEG-Based Mental Workload Index: A Passive Brain-Computer Interface Application in Realistic Air Traffic Control Environment`,
    authors: `Pietro Aricò`,
    year: 2016,
    description: `Adaptive Automation (AA) is a promising approach to keep the task workload demand within appropriate levels in order to avoid both the under- and over-load conditions, hence enhancing the overall performance and safety of the human-machine system.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Adaptive Automation Triggered by EEG-Based Mental Workload I.pdf`,
    sourceUrl: `https://doi.org/10.3389/fnhum.2016.00539`,
    category: `EEG & Brain Signals`,
  },
  {
    title: `Combining and comparing EEG, peripheral physiology and eye-related measures for the assessment of mental workload`,
    authors: `Maarten A. Hogervorst`,
    year: 2014,
    description: `While studies exist that compare different physiological variables with respect to their association with mental workload, it is still largely unclear which variables supply the best information about momentary workload of an individual and what is the benefit of combining them.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Combining and comparing EEG_ peripheral physiology and eye-r.pdf`,
    sourceUrl: `https://doi.org/10.3389/fnins.2014.00322`,
    category: `EEG & Brain Signals`,
  },
  {
    title: `EEG-Based Estimation and Classification of Mental Fatigue`,
    authors: `Leonard J. Trejo, Karla Kubitz, Roman Rosipal, Rebekah L. Kochavi, Leslie D. Montgomery`,
    year: 2015,
    description: `Mental fatigue was associated with increased power in frontal theta (θ) and parietal alpha (α) EEG rhythms. A statistical classifier can use these effects to model EEG-fatigue relationships accurately.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/EEG-Based Estimation and Classification of Mental Fatigue.pdf`,
    sourceUrl: `https://doi.org/10.4236/psych.2015.65055`,
    category: `EEG & Brain Signals`,
  },
  {
    title: `Pulsed out of awareness: EEG alpha oscillations represent a pulsed-inhibition of ongoing cortical processing`,
    authors: `Kyle E. Mathewson`,
    year: 2011,
    description: `Alpha oscillations are ubiquitous in the brain, but their role in cortical processing remains a matter of debate.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Pulsed Out of Awareness_ EEG Alpha Oscillations Represent a.pdf`,
    sourceUrl: `https://doi.org/10.3389/fpsyg.2011.00099`,
    category: `EEG & Brain Signals`,
  },
  {
    title: `The Berlin Brain Computer Interface  Non-Medical Uses of BCI`,
    authors: ``,
    year: 2010,
    description: `Reviews the Berlin BCI system's applications outside medicine, including passive mental workload classification, operator state monitoring, and hands-free control interfaces, demonstrating that EEG-based brain-computer interfaces are viable tools in everyday and safety-critical industrial settings.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/The Berlin Brain_Computer Interface_ Non-Medical Uses of BCI.pdf`,
    sourceUrl: `https://doi.org/10.3389/fnins.2010.00198`,
    category: `EEG & Brain Signals`,
  },
  {
    title: `A breadth-first survey of eye-tracking applications`,
    authors: ``,
    year: 2002,
    description: `Wide-ranging survey of eye-tracking technology across disciplines — usability testing, reading research, medical diagnosis, and human-computer interaction — cataloguing the behavioral and cognitive insights each application domain has produced along with key methodological considerations.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/A breadth-first survey of eye-tracking applications.pdf`,
    sourceUrl: `https://doi.org/10.3758/bf03195475`,
    category: `Eye Tracking & Gaze`,
  },
  {
    title: `A review of eye tracking for understanding and improving diagnostic interpretation`,
    authors: `Tad T. Brunyé`,
    year: 2019,
    description: `Inspecting digital imaging for primary diagnosis introduces perceptual and cognitive demands for physicians tasked with interpreting visual medical information and arriving at appropriate diagnoses and treatment decisions. The process of medical interpretation and diagnosis involv es a complex interplay between visual perception and multiple cognitive processes, including memory retrieval , proble`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/A review of eye tracking for understanding and improving dia.pdf`,
    sourceUrl: `https://doi.org/10.1186/s41235-019-0159-2`,
    category: `Eye Tracking & Gaze`,
  },
  {
    title: `A Study on Tiredness Assessment by Using Eye Blink Detection`,
    authors: ``,
    year: 2019,
    description: `In this paper, the loss of attention of automotive drivers is studied by using eye blink detection. Facial landmark detection  for detecting eye is explored. Afterward, eye blink is detected using Eye Aspect Ratio. By comparing the time of eye closure  to a particular period, the driver’ s tiredness is decided. The total number of eye blinks in a minute is counted to detect  drowsiness. Calculatio`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/A Study on Tiredness Assessment by Using Eye Blink Detection.pdf`,
    sourceUrl: `https://doi.org/10.17576/jkukm-2019-31(2)-04`,
    category: `Eye Tracking & Gaze`,
  },
  {
    title: `Eye Movement Analysis for Activity Recognition Using Electrooculography`,
    authors: `Andreas Bulling, Jamie A. Ward, Hans Gellersen, and Gerhard Tröster`,
    year: 2011,
    description: `In this work we investigate eye movement analysis as a new sensing modality for activity recognition. Eye movement data was recorded using an electrooculography (EOG) system. We ﬁrst describe and evaluate algorithms for detecting three eye movement characteristics from EOG signals - saccades, ﬁxations, and blinks - and propose a method for assessing repetitive patterns of eye movements. We then de`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Eye Movement Analysis for Activity Recognition Using Electro.pdf`,
    sourceUrl: `https://doi.org/10.1109/tpami.2010.86`,
    category: `Eye Tracking & Gaze`,
  },
  {
    title: `Individual differences in baseline oculometrics: Examining variation in baseline pupil diameter, spontaneous eye blink rate, and fixation stability`,
    authors: `Nash Unsworth; Matthew K. Robison; Ashley L. Miller`,
    year: 2019,
    description: `Individual differences in baseline oculometrics (baseline pupil diameter, spontaneous eye blink rate, fixation stability), and their relation with cognitive abilities, personality traits, and self-report assessments were examined. Participants performed a baseline eye measure in which they were instructed to stare at a fixation point onscreen for 5 min. Following the baseline eye measure, particip`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Individual differences in baseline oculometrics_ Examining v.pdf`,
    sourceUrl: `https://doi.org/10.3758/s13415-019-00709-z`,
    category: `Eye Tracking & Gaze`,
  },
  {
    title: `Pupil diameter tracks changes in control state predicted by the adaptive gain theory of locus coeruleus function`,
    authors: ``,
    year: 2010,
    description: `Demonstrates that pupil diameter reliably indexes shifts between exploratory and exploitative cognitive control states as predicted by adaptive gain theory, providing a non-invasive window into locus coeruleus-norepinephrine activity during decision-making and sustained attention tasks.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Pupil diameter tracks changes in control state predicted by.pdf`,
    sourceUrl: `https://doi.org/10.3758/cabn.10.2.252`,
    category: `Eye Tracking & Gaze`,
  },
  {
    title: `Pupil dilation as an index of effort in cognitive control tasks: A review`,
    authors: `Pauline van der Wel`,
    year: 2018,
    description: `Pupillometry research has experienced an enormous revi val in the last two decades. Here we briefly review the surge of recent studies on task-evoked pupil dilation in the cont ext of cognitive control tasks with the primary aim being to evaluate the feasibility of using pupil dilation as an index o f effort exertion, rather than task demand or difficulty. Our review shows that across the three co`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Pupil dilation as an index of effort in cognitive control ta.pdf`,
    sourceUrl: `https://doi.org/10.3758/s13423-018-1432-y`,
    category: `Eye Tracking & Gaze`,
  },
  {
    title: `Real-time eye blink detection using general cameras: a facial landmarks approach`,
    authors: `Mogila Igor`,
    year: 2023,
    description: `Eyes are essential in Human -Computer Interaction (HCI) as they provide valuable  insights into a person's thoughts and intentions. However, current eye movement analysis methods  require specialized equipment or high -quality videos, making them les s accessible and usable. This  paper proposes a real-time eye blink detection algorithm that uses standard cameras, making it widely  applicable and`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Real-time eye blink detection using general cameras_ a facia.pdf`,
    sourceUrl: `https://doi.org/10.46299/j.isjea.20230205.01.`,
    category: `Eye Tracking & Gaze`,
  },
  {
    title: `An automated behavioral measure of mind wandering during computerized reading`,
    authors: `Myrthe Faber`,
    year: 2017,
    description: `Mind wandering is a ubiquitous phenomenon in which attention shifts from task-related to task-unrelated thoughts. The last decade has witnessed an explosion of inter- est in mind wandering, but research has been stymied by a lack of objective measures, leading to a near-exclusive reli- ance on self-reports. We addressed this issue by developing an eye-gaze-based, machine-learned model of mind wand`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/An automated behavioral measure of mind wandering during com.pdf`,
    sourceUrl: `https://doi.org/10.3758/s13428-017-0857-y`,
    category: `Focus & Attention`,
  },
  {
    title: `Attention  interpretation  and memory biases in subclinical`,
    authors: `DICT`,
    year: 0,
    description: `Examines how subclinical levels of anxiety and depression produce measurable biases in how individuals orient attention, interpret ambiguous information, and encode memories — showing cognitive distortions emerge well below the threshold of clinical diagnosis.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Attention_ interpretation_ and memory biases in subclinical.pdf`,
    category: `Focus & Attention`,
  },
  {
    title: `Exogenous (automatic) attention to emotional stimuli: a review`,
    authors: ``,
    year: 2014,
    description: `Current knowledge on the architecture of exoge- nous attention (also called automatic, bottom-up, or stimulus- driven attention, among other terms) has been mainly obtained from studies employing neutral, anodyne stimuli. Since, from an evolutionary perspective, exogenous attention can be un- derstood as an adaptive tool for rapidly detecting salient events, reorienting processing resources to the`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Exogenous _automatic_ attention to emotional stimuli_ a revi.pdf`,
    sourceUrl: `https://doi.org/10.3758/s13415-014-0270-2`,
    category: `Focus & Attention`,
  },
  {
    title: `Measuring Narrative Engagement`,
    authors: ``,
    year: 2009,
    description: `Proposes and validates a multi-component scale for measuring narrative engagement, identifying transportation into the story, attentional focus, emotional engagement, and narrative presence as distinct, measurable dimensions of how deeply audiences become absorbed in content.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Measuring Narrative Engagement.pdf`,
    sourceUrl: `https://doi.org/10.1080/15213260903287259`,
    category: `Focus & Attention`,
  },
  {
    title: `Multimodal assessment of adult attention‐deficit hyperactivity disorder: A controlled virtual seminar room study`,
    authors: `Annika Wiebe`,
    year: 2023,
    description: `In the assessment of adult attention-deficit hyperactivity disorder (ADHD) symptoms, the diagnostic value of neuropsychological testing is limited. Partly, this is due to the rather low ecological validity of traditional neuropsychological tests, which usually present abstract stimuli on a computer screen. A potential remedy for this shortcom- ing might be the use of virtual reality (VR), which en`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Multimodal assessment of adult attention_deficit hyperactivi.pdf`,
    sourceUrl: `https://doi.org/10.1002/cpp.2863`,
    category: `Focus & Attention`,
  },
  {
    title: `Multimodal Engagement Analysis from Facial Videos in the Classroom`,
    authors: ``,
    year: 2023,
    description: `Student engagement is a key construct for learning and teaching. While most of the literature explored the student engagement analysis on computer-based settings, this paper extends that focus to classroom instruction. To best examine student visual engagement in the classroom, we conducted a study utilizing the audiovisual recordings of classes at a secondary school over one and a half month’s ti`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Multimodal Engagement Analysis From Facial Videos in the Cla.pdf`,
    sourceUrl: `https://doi.org/10.1109/taffc.2021.3127692`,
    category: `Focus & Attention`,
  },
  {
    title: `Optimizing performance through intrinsic motivation and attention for learning: The OPTIMAL theory of motor learning`,
    authors: `Gabriele Wulf`,
    year: 2016,
    description: `Effective motor performance is important for sur- viving and thriving, and skilled movement is critical in many activities. Much theorizing over the past few decades has fo- cused on how certain practice conditions affect the processing of task-related information to affect learning. Yet, existing theoretical perspectives do not accommodate significant re- cent lines of evidence demonstrating moti`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Optimizing performance through intrinsic motivation and atte.pdf`,
    sourceUrl: `https://doi.org/10.3758/s13423-015-0999-9`,
    category: `Focus & Attention`,
  },
  {
    title: `Positive valence music restores executive control over sustained attention`,
    authors: `Carryl L. Baldwin, Bridget A. Lewis`,
    year: 2017,
    description: `Music sometimes improves performance in sustained attention tasks. But the type of music employed in previous investigations has varied considerably, which can account for equivo- cal results. Progress has been hampered by lack of a systematic database of music varying in key characteristics like tempo and valence. The aims of this study were to establish a database of popular music varying along`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Positive valence music restores executive control over susta.pdf`,
    sourceUrl: `https://doi.org/10.1371/journal.pone.0186231`,
    category: `Focus & Attention`,
  },
  {
    title: `Restoration of Attention by Rest in a Multitasking World: Theory, Methodology, and Empirical Evidence`,
    authors: `Frank Schumann`,
    year: 2022,
    description: `In this work, we evaluate the status of both theory and empirical evidence in the field of experimental rest-break research based on a framework that combines mental-chronometry and psychometric-measurement theory.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Restoration of Attention by Rest in a Multitasking World_ Th.pdf`,
    sourceUrl: `https://doi.org/10.3389/fpsyg.2022.867978`,
    category: `Focus & Attention`,
  },
  {
    title: `Rethinking (Dis)engagement in human-computer interaction`,
    authors: `Heather L. O'Brien`,
    year: 2022,
    description: `Computers in Human Behavior, 128 (2022) 107109. doi:10.1016/j.chb.2021.107109`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Rethinking _Dis_engagement in human-computer interaction.pdf`,
    sourceUrl: `https://doi.org/10.1016/j.chb.2021.107109`,
    category: `Focus & Attention`,
  },
  {
    title: `Soft-label guided stacked dual attention network for head pose estimation and its application to classroom gaze analysis`,
    authors: `Luhui Xu, Zecheng Li, Yanling Gan & Haiying Xia`,
    year: 0,
    description: `Presents a deep learning model using soft-label supervision and stacked dual attention modules for accurate head pose estimation from monocular images, then applies it to classroom gaze analysis to identify which students are visually attending to the board or instructor.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Soft-label guided stacked dual attention network for head po.pdf`,
    category: `Focus & Attention`,
  },
  {
    title: `Spatial Neglect and Attention Networks`,
    authors: ``,
    year: 2011,
    description: `Unilateral spatial neglect is a common neurological syndrome following predominantly right hemisphere injuries to ventral fronto-parietal cortex. We propose that neglect reflects deficits in the coding of saliency, control of spatial attention, and representation within an egocentric frame of reference, in conjunction with non-spatial deficits of reorienting, target detection, and arousal/ vigilan`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Spatial Neglect and Attention Networks.pdf`,
    sourceUrl: `https://doi.org/10.1146/annurev-neuro-061010-113731`,
    category: `Focus & Attention`,
  },
  {
    title: `The role of prefrontal cortex in working-memory capacity, executive attention, and general fluid intelligence: An individual-differences perspective`,
    authors: ``,
    year: 2002,
    description: `Reviews converging evidence that individual differences in prefrontal cortex efficiency underlie a shared resource supporting working memory span, attentional control, and fluid intelligence — explaining why these three seemingly distinct capacities correlate so strongly across people.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/The role of prefrontal cortex in working-memory capacity_ ex.pdf`,
    sourceUrl: `https://doi.org/10.3758/bf03196323`,
    category: `Focus & Attention`,
  },
  {
    title: `Vigilance Effects in Resting-State fMRI`,
    authors: `Thomas T. Liu`,
    year: 2020,
    description: `Measures of resting-state functional magnetic resonance imaging (rsfMRI) activity have been shown to be sensitive to cognitive function and disease state.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Vigilance Effects in Resting-State fMRI.pdf`,
    sourceUrl: `https://doi.org/10.3389/fnins.2020.00321`,
    category: `Focus & Attention`,
  },
  {
    title: `Acute evaluation of sport-related concussion and implications for the Sport Concussion Assessment Tool (SCAT6) for adults, adolescents and children: a systematic review`,
    authors: ``,
    year: 2023,
    description: `Systematic review updating the clinical evidence for acute concussion evaluation in sport, directly informing the SCAT6 protocol used by medical staff for on-field assessment of athletes from youth to professional levels across multiple contact sports.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Acute evaluation of sport-related concussion and implication.pdf`,
    sourceUrl: `https://doi.org/10.1136/bjsports-2022-106661`,
    category: `Health & Wellbeing`,
  },
  {
    title: `Digital Eye Strain- A Comprehensive Review`,
    authors: `Kirandeep Kaur`,
    year: 2022,
    description: `Ophthalmology and Therapy, https://doi.org/10.1007/s40123-022-00540-9`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Digital Eye Strain- A Comprehensive Review.pdf`,
    sourceUrl: `https://doi.org/10.1007/s40123-022-00540-9`,
    category: `Health & Wellbeing`,
  },
  {
    title: `Digital eye strain: prevalence, measurement and amelioration`,
    authors: ``,
    year: 2018,
    description: `Reviews the growing prevalence of digital eye strain from prolonged screen use, evaluates the validity of different symptom measurement approaches, and assesses the evidence for amelioration strategies including the 20-20-20 rule, blue-light filters, and corrective lenses.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Digital eye strain_ prevalence_ measurement and amelioration.pdf`,
    sourceUrl: `https://doi.org/10.1136/bmjophth-2018-000146`,
    category: `Health & Wellbeing`,
  },
  {
    title: `Digital therapeutics in neurology`,
    authors: `G. Abbadessa`,
    year: 2021,
    description: `Journal of Neurology, https://doi.org/10.1007/s00415-021-10608-4`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Digital therapeutics in neurology.pdf`,
    sourceUrl: `https://doi.org/10.1007/s00415-021-10608-4`,
    category: `Health & Wellbeing`,
  },
  {
    title: `Fatigue Detection Using Raspberry Pi 3`,
    authors: `ARUN`,
    year: 2018,
    description: `Driver drowsiness is a primary cause of several highway calamities leads to severe physical injuries, loss of money, and loss of human  life. The implementation of driver drowsiness detection in real-time will aid in avoiding major accidents. The system is designed for  four-wheelers wherein the driver’s fatigue or drowsiness is detected and alerts the person. The proposed method will use 5-megapi`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Fatigue Detection Using Raspberry Pi 3.pdf`,
    sourceUrl: `https://doi.org/10.14419/ijet.v7i2.24.11993`,
    category: `Health & Wellbeing`,
  },
  {
    title: `Pathophysiology of Migraine  A Disorder of Sensory Processing`,
    authors: ``,
    year: 2017,
    description: `Characterizes migraine as a disorder of sensory processing and cortical excitability rather than purely a vascular condition, reviewing trigeminovascular activation, cortical spreading depression, and central sensitization as the key mechanisms underlying migraine pain and aura.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Pathophysiology of Migraine_ A Disorder of Sensory Processin.pdf`,
    sourceUrl: `https://doi.org/10.1152/physrev.00034.2015`,
    category: `Health & Wellbeing`,
  },
  {
    title: `The impact of anxiety upon cognition: perspectives from human threat of shock studies`,
    authors: `Oliver J. Robinson`,
    year: 2013,
    description: `Anxiety disorders constitute a sizeable worldwide health burden with profound social and economic consequences.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/The impact of anxiety upon cognition_ perspectives from huma.pdf`,
    sourceUrl: `https://doi.org/10.3389/fnhum.2013.00203`,
    category: `Health & Wellbeing`,
  },
  {
    title: `The Influences of Emotion on Learning and Memory`,
    authors: `Aamir S. Malik`,
    year: 2017,
    description: `Emotion has a substantial influence on the cognitive processes in humans, including perception, attention, learning, memory, reasoning, and problem solving.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/The Influences of Emotion on Learning and Memory.pdf`,
    sourceUrl: `https://doi.org/10.3389/fpsyg.2017.01454`,
    category: `Memory & Cognition`,
  },
  {
    title: `The magical number 4 in short-term memory: A reconsideration of mental storage capacity`,
    authors: `Nelson Cowan`,
    year: 2001,
    description: `Miller (1956) summarized evidence that people can remember about seven chunks in short-term memory (STM) tasks. How- ever, that number was meant more as a rough estimate and a rhetorical device than as a real capacity limit. Others have since suggested that there is a more precise capacity limit, but that it is only three to five chunks. The present target article brings together a wide vari- ety`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/The magical number 4 in short-term memory_ A reconsideration.pdf`,
    sourceUrl: `https://doi.org/10.1017/s0140525x01003922`,
    category: `Memory & Cognition`,
  },
  {
    title: `Effects of mindful-attention and compassion meditation training on amygdala response to emotional stimuli in an ordinary, non-meditative state`,
    authors: `Gaëlle Desbordes`,
    year: 2019,
    description: `The amygdala has been repeatedly implicated in emotional processing of both positive and negative-valence stimuli.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Effects of mindful-attention and compassion meditation train.pdf`,
    sourceUrl: `https://doi.org/10.31231/osf.io/hzv65`,
    category: `Mindfulness & Meditation`,
  },
  {
    title: `Executive control and felt concentrative engagement following intensive meditation training`,
    authors: `Anthony P. Zanesco`,
    year: 2019,
    description: `Various forms of mental training have been shown to improve performance on cognitively demanding tasks.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Executive control and felt concentrative engagement followin.pdf`,
    sourceUrl: `https://doi.org/10.31231/osf.io/kjvy8`,
    category: `Mindfulness & Meditation`,
  },
  {
    title: `Mindfulness training modifies subsystems of attention`,
    authors: ``,
    year: 2007,
    description: `Demonstrates that mindfulness meditation training selectively improves specific attentional subsystems — particularly conflict monitoring and sustained alerting — rather than boosting general attention capacity, with gains detectable after as little as five days of practice.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Mindfulness training modifies subsystems of attention.pdf`,
    sourceUrl: `https://doi.org/10.3758/cabn.7.2.109`,
    category: `Mindfulness & Meditation`,
  },
  {
    title: `Potential self-regulatory mechanisms of yoga for psychological health`,
    authors: `David R. Vago`,
    year: 2014,
    description: `Research suggesting the beneficial effects of yoga on myriad aspects of psychological health has proliferated in recent years, yet there is currently no overarching framework by which to understand yoga's potential beneficial effects.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Potential self-regulatory mechanisms of yoga for psychologic.pdf`,
    sourceUrl: `https://doi.org/10.3389/fnhum.2014.00770`,
    category: `Mindfulness & Meditation`,
  },
  {
    title: `Regular, brief mindfulness meditation practice improves electrophysiological markers of attentional control`,
    authors: `Peter Malinowski`,
    year: 2012,
    description: `Mindfulness-based meditation practices involve various attentional skills, including the ability to sustain and focus ones attention.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Regular_ brief mindfulness meditation practice improves elec.pdf`,
    sourceUrl: `https://doi.org/10.3389/fnhum.2012.00018`,
    category: `Mindfulness & Meditation`,
  },
  {
    title: `Self-awareness, self-regulation, and self-transcendence (S-ART): a framework for understanding the neurobiological mechanisms of mindfulness`,
    authors: `David R. Vago`,
    year: 2012,
    description: `Mindfulness—as a state, trait, process, type of meditation, and intervention has proven to be beneficial across a diverse group of psychological disorders as well as for general stress reduction.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Self-awareness_ self-regulation_ and self-transcendence _S-A.pdf`,
    sourceUrl: `https://doi.org/10.3389/fnhum.2012.00296`,
    category: `Mindfulness & Meditation`,
  },
  {
    title: `Neuroergonomics: a review of applications to physical and cognitive work`,
    authors: `Ranjana K. Mehta`,
    year: 2013,
    description: `Neuroergonomics is an emerging science that is defined as the study of the human brain in relation to performance at work and in everyday settings.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Neuroergonomics_ a review of applications to physical and co.pdf`,
    sourceUrl: `https://doi.org/10.3389/fnhum.2013.00889`,
    category: `Neuroergonomics`,
  },
  {
    title: `Perception of Upright: Multisensory Convergence and the Role of Temporo-Parietal Cortex`,
    authors: `Amir Kheradmand`,
    year: 2017,
    description: `We inherently maintain a stable perception of the world despite frequent changes in the head, eye, and body positions.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Perception of Upright_ Multisensory Convergence and the Role.pdf`,
    sourceUrl: `https://doi.org/10.3389/fneur.2017.00552`,
    category: `Neuroergonomics`,
  },
  {
    title: `The Emerging Neuroscience of Intrinsic Motivation: A New Frontier in Self-Determination Research`,
    authors: `Stefano I. Di Domenico`,
    year: 2017,
    description: `Intrinsic motivation refers to people's spontaneous tendencies to be curious and interested, to seek out challenges and to exercise and develop their skills and knowledge, even in the absence of operationally separable rewards.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/The Emerging Neuroscience of Intrinsic Motivation_ A New Fro.pdf`,
    sourceUrl: `https://doi.org/10.3389/fnhum.2017.00145`,
    category: `Neuroergonomics`,
  },
  {
    title: `Is Sleep Essential?`,
    authors: `Chiara Cirelli, Giulio Tononi`,
    year: 0,
    description: `Examines whether sleep is an evolutionary necessity, reviewing evidence that virtually all animals sleep and that the consequences of sleep deprivation — from immune failure to cognitive collapse — point to critical restorative functions that cannot be replaced by wakeful rest.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Is Sleep Essential_.pdf`,
    category: `Neuroscience & Research`,
  },
  {
    title: `The Impact of Visual Digital Unit Exposure on Ocular Symptoms of Computer Vision Syndrome Among Selangor Office Workers`,
    authors: `Suneta Atika Halim`,
    year: 0,
    description: `Objective: Computer Visual Syndrome (CVS) is a common condition characterized by a range of ocular symptoms  resulting from excessive screen time. As visual digital unit (VDU) usage has skyrocketed across all age groups, CVS has  become a prevalent issue in both personal and professional life. Therefore, this study aimed to investigate the association  between the impact of VDU and ocular symptoms`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/The Impact of Visual Digital Unit Exposure on Ocular Symptom.pdf`,
    category: `Neuroscience & Research`,
  },
  {
    title: `A Process Model of the Formation of Spatial Presence Experiences`,
    authors: `Werner Wirth`,
    year: 2007,
    description: `Proposes a cognitive process model explaining how spatial presence — the subjective sense of being located inside a virtual or mediated environment — forms through attentional resource allocation and mental model construction during media consumption.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/A Process Model of the Formation of Spatial Presence Experie.pdf`,
    sourceUrl: `https://doi.org/10.1080/15213260701283079`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Automaticity of social cues: The influence of limiting cognitive resources on head orientation cueing`,
    authors: ``,
    year: 2018,
    description: `Shows that head orientation automatically captures spatial attention even under heavy cognitive load, demonstrating that social gaze cues operate via involuntary attentional mechanisms that persist when deliberate executive resources are fully occupied by another task.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Automaticity of social cues_ The influence of limiting cogni.pdf`,
    sourceUrl: `https://doi.org/10.1038/s41598-018-28548-x`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Catching the mind in flight: Using behavioral indices to detect mindless reading in real time`,
    authors: `Michael S. Franklin, Michael D. Mrazek, Jonathan W. Schooler`,
    year: 2011,
    description: `Although mind wandering during reading is extremely common, researchers have only recently begun to study how it relates to reading behavior. In the present study, we used a word-by-word reading paradigm to investigate whether it could be possible to predict in real time whether a participant would report mind wandering when probed. By taking advantage of the finding that reaction times to individ`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Catching the mind in flight_ Using behavioral indices to det.pdf`,
    sourceUrl: `https://doi.org/10.3758/s13423-011-0109-6`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Conscious perception of errors and its relation to the anter`,
    authors: `Markus Ullsperger, Claudia Harsay, Christian Wessel, Ulrike Ridderinkhof`,
    year: 2010,
    description: `To detect erroneous action outcomes is neces- sary for ﬂexible adjustments and therefore a prerequisite of adaptive, goal-directed behavior. While performance monitoring has been studied intensively over two decades and a vast amount of knowledge on its functional neuro- anatomy has been gathered, much less is known about conscious error perception, often referred to as error awareness. Here, we r`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Conscious perception of errors and its relation to the anter.pdf`,
    sourceUrl: `https://doi.org/10.1007/s00429-010-0261-1`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Decision Making, the P3, and the Locus Coeruleus–Norepinephrine System`,
    authors: `Jonathan D. Cohen`,
    year: 2005,
    description: `Proposes that the P3 EEG component reflects adaptive gain modulation by the locus coeruleus-norepinephrine system, linking this neural signal to the decision-making process of updating contextual representations and committing to behavioral responses under uncertainty.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Decision making_ the P3_ and the locus coeruleus--norepineph.pdf`,
    sourceUrl: `https://doi.org/10.1037/0033-2909.131.4.510`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Do your eyes give you away? A validation study of eye-movement measures used as indicators for mindless reading`,
    authors: `Lena Steindorf`,
    year: 2019,
    description: `Identifying eye-movement measures as objective indicators of mind wandering seems to be a work in progress. We reviewed research comparing eye movements during self-categorized episodes of normal versus mindless reading and found little con- sensus regarding the specific measures that are sensitive to attentional decoupling during mind wandering. To address this issue of inconsistency, we conducte`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Do your eyes give you away_ A validation study of eye-moveme.pdf`,
    sourceUrl: `https://doi.org/10.3758/s13428-019-01214-4`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Dynamic adaptation of large-scale brain networks in response`,
    authors: `Erno J. Hermans`,
    year: 2014,
    description: `Characterizes how large-scale brain networks — including the default mode, frontoparietal, and salience networks — dynamically reorganize in response to changing cognitive demands, enabling flexible goal-directed behavior and efficient task switching.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Dynamic adaptation of large-scale brain networks in response.pdf`,
    sourceUrl: `https://doi.org/10.1016/j.tins.2014.03.006`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Visualization Analysis of Learning Attention Based on Single-image PnP Head Pose Estimation`,
    authors: `Li Dongxing`,
    year: 0,
    description: `Learning attention analysis of students is the important indicator of classroom  teaching/learning quantitative evaluation. Owing to the fact that the head -mounted eye  tracker is expensive and unsuitable to be widely used in the large -scale classroom  evaluation under expenditure limitation, in this paper, we uses the PnP (Perspective-n- Point) method to estimate student 's head pose for single`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Visualization Analysis of Learning Attention Based on Single.pdf`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Eye Behavior Associated with Internally versus Externally Directed Cognition`,
    authors: `Mathias Benedek`,
    year: 2017,
    description: `What do our eyes do when we are focused on internal representations such as during imagination or planning?`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Eye Behavior Associated with Internally versus Externally Di.pdf`,
    sourceUrl: `https://doi.org/10.3389/fpsyg.2017.01092`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Eye Movement and Pupil Measures: A Review`,
    authors: `Bhanuka Mahanama `,
    year: 0,
    description: `Comprehensive review of eye movement and pupil dilation measures as cognitive state indicators, covering fixations, saccades, microsaccades, and pupil dynamics — with applications to attention tracking, cognitive load estimation, and human-computer interaction design.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Eye Movement and Pupil Measures_ A Review.pdf`,
    category: `Neuroscience & Research`,
  },
  {
    title: `From the Lab to the Wild: Examining Generalizability of Video-based Mind Wandering Detection`,
    authors: `Babette Bühler`,
    year: 2024,
    description: `Student’s shift of attention away from a current learning task to task-unrelated thought, also called mind wandering, occurs about 30% of the time spent on education-related activities. Its frequent occurrence has a negative effect on learning outcomes across learning tasks. Automated detection of mind wandering might offer an opportunity to assess the attentional state continuously and non-intrus`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/From the Lab to the Wild_ Examining Generalizability of Vide.pdf`,
    sourceUrl: `https://doi.org/10.1007/s40593-024-00412-2`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Driver Drowsiness Detection Using Gray Wolf Optimizer Based on Face and Eye Tracking`,
    authors: ``,
    year: 0,
    description: `It is critical today to provide safe and collision-free  transport. As a result, identifying the driver’s drowsiness before  their capacity to drive is jeopardized. An automated hybrid  drowsiness classification method that incorporates the artificial  neural network (ANN) and the gray wolf optimizer (GWO) is  presented to discriminate human drowsiness and fatigue for this  aim.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Driver Drowsiness Detection Using Gray Wolf Optimizer Based.pdf`,
    category: `Neuroscience & Research`,
  },
  {
    title: `How Indoor Environmental Quality Affects Occupants’ Cognitive Functions: a Critical Review`,
    authors: `Wang, Chao`,
    year: 2021,
    description: `Demonstrates through a critical review of controlled studies that indoor environmental factors — particularly CO2 concentration, temperature, and ventilation rate — have significant effects on occupant cognitive performance, with elevated CO2 producing the most consistent impairments.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/How indoor environmental quality affects occupants_ cognitiv.pdf`,
    sourceUrl: `https://doi.org/10.1016/j.buildenv.2021.107647`,
    category: `Neuroscience & Research`,
  },
  {
    title: `The effects of task difficulty on gaze behaviour during landing with visual flight rules in low-time pilots`,
    authors: `Naila Ayala`,
    year: 0,
    description: `Investigates how increasing landing difficulty affects pilots' visual attention, finding that harder approaches reduce gaze diversity, prolong fixation duration on critical instrument zones, and reduce time spent scanning for external hazards — with implications for training design.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/The effects of task difficulty on gaze behaviour during land.pdf`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Cognitive Load Estimation in VR Flight Simulator`,
    authors: `P Archana Hebbar`,
    year: 0,
    description: `Evaluates methods for estimating cognitive load during VR flight simulator training, comparing physiological indicators — including pupil dilation, blink rate, and eye movement entropy — as real-time markers of pilot mental workload across varying task difficulty levels.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Cognitive load estimation in VR flight simulator.pdf`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Multi-channel EEG recordings during a sustained-attention driving task`,
    authors: `Zehong Cao`,
    year: 0,
    description: `We described driver behaviour and brain dynamics acquired from a 90-minute sustained-attention task in an immersive driving simulator. The data include 62 copies of 32-channel electroencephalography (EEG) data for 27 subjects that drove on a four-lane highway and were asked to keep the car cruising in the centre of the lane. Lane-departure events were randomly induced to make the car drift from th`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Multi-channel EEG recordings during a sustained-attention dr.pdf`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Introspective Minds: Using ALE Meta-Analyses to Study Commonalities in the Neural Correlates of Emotional Processing, Social & Unconstrained Cognition`,
    authors: `Leonhard Schilbach`,
    year: 0,
    description: `Previous research suggests overlap between brain regions that show task-induced deactivations and those activated during the performance of social-cognitive tasks. Here, we present results of quantitative meta-analyses of neuroimaging studies, which confirm a statistical convergence in the neural correlates of social and resting state cognition. Based on the idea that both social and unconstrained`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Introspective Minds_ Using ALE Meta-Analyses to Study Common.pdf`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Investigating Gaze of Children with ASD in Naturalistic Settings`,
    authors: `Basilio Noris`,
    year: 0,
    description: `Background: Visual behavior is known to be atypical in Autism Spectrum Disorders (ASD). Monitor-based eye-tracking studies have measured several of these atypicalities in individuals with Autism. While atypical behaviors are known to be accentuated during natural interactions, few studies have been made on gaze behavior in natural interactions. In this study we focused on i) whether the findings d`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Investigating Gaze of Children with ASD in Naturalistic Sett.pdf`,
    category: `Neuroscience & Research`,
  },
  {
    title: `What defines mindfulness-based programs? The warp and the weft`,
    authors: `R. S. Crane`,
    year: 0,
    description: `Analyzes the core components that define mindfulness-based programs, distinguishing the essential structural elements ('the warp') from the supportive teaching qualities and relational context ('the weft') — arguing that both are necessary for clinical effectiveness.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/What defines mindfulness-based programs_ The warp and the we.pdf`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Trends in Workplace Wearable Technologies and Connected‐Worker Solutions for Next‐Generation Occupational Safety, Health, and Productivity`,
    authors: `Vishal Patel, Austin Chesmore, Christopher M. Legner, Santosh Pandey`,
    year: 2021,
    description: `Reviews the landscape of wearable sensors and connected-worker platforms deployed for real-time monitoring of occupational safety, physiological status, and cognitive load — identifying key technical challenges and the most promising integration opportunities for next-generation workplaces.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Trends in Workplace Wearable Technologies and Connected_Work.pdf`,
    sourceUrl: `https://doi.org/10.1002/aisy.202100099`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Bidirectional interactions between circadian entrainment and cognitive performance`,
    authors: ``,
    year: 2024,
    description: `Reviews the two-way relationship between circadian rhythm entrainment and cognitive performance, showing that circadian phase shapes alertness and memory consolidation while cognitive demands and light exposure can in turn shift the timing of the internal clock.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Bidirectional interactions between circadian entrainment and.pdf`,
    sourceUrl: `https://doi.org/10.55277/researchhub.vq5dnd6h`,
    category: `Neuroscience & Research`,
  },
  {
    title: `Circadian and wakefulness-sleep modulation of cognition in humans`,
    authors: `Kenneth P. Wright`,
    year: 2012,
    description: `Cognitive and affective processes vary over the course of the 24 h day.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Circadian and wakefulness-sleep modulation of cognition in h.pdf`,
    sourceUrl: `https://doi.org/10.3389/fnmol.2012.00050`,
    category: `Sleep & Circadian Rhythm`,
  },
  {
    title: `Circadian dynamics in measures of cortical excitation and inhibition balance`,
    authors: `Sarah L. Chellappa`,
    year: 2016,
    description: `Tracks how the balance between cortical excitation and inhibition fluctuates across the 24-hour circadian cycle in healthy adults, providing mechanistic insight into how sleep-wake timing influences neural excitability and cognitive performance throughout the day.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Circadian dynamics in measures of cortical excitation and in.pdf`,
    sourceUrl: `https://doi.org/10.1038/srep33661`,
    category: `Sleep & Circadian Rhythm`,
  },
  {
    title: `Circuit-based interrogation of sleep control`,
    authors: `Franz Weber; Yang Dan`,
    year: 2016,
    description: `Applies optogenetics and chemogenetics to map the specific neural circuits controlling sleep onset, maintenance, and arousal in the mammalian brain, providing a mechanistic framework for understanding how sleep states are actively generated and regulated.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Circuit-based interrogation of sleep control.pdf`,
    sourceUrl: `https://doi.org/10.1038/nature19773`,
    category: `Sleep & Circadian Rhythm`,
  },
  {
    title: `Intrinsic brain connectivity after partial sleep deprivation in young and older adults: results from the Stockholm Sleepy Brain study`,
    authors: `Gustav Nilsonne`,
    year: 2016,
    description: `Uses resting-state fMRI to show that one night of partial sleep deprivation alters intrinsic brain network connectivity differently in young versus older adults, with older adults showing less network resilience in default mode and frontoparietal regions.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Intrinsic brain connectivity after partial sleep deprivation.pdf`,
    sourceUrl: `https://doi.org/10.1101/073494`,
    category: `Sleep & Circadian Rhythm`,
  },
  {
    title: `Sleep and immune function`,
    authors: ``,
    year: 2011,
    description: `Sleep and the circadian system exert a strong regulatory influence on immune functions. Investigations of the normal sleep–wake cycle showed that immune para- meters like numbers of undifferentiated naïve T cells and the production of pro-inflammatory cytokines exhibit peaks during early nocturnal sleep whereas circulating numbers of immune cells with immediate effector functions, like cytotoxic n`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Sleep and immune function.pdf`,
    sourceUrl: `https://doi.org/10.1007/s00424-011-1044-0`,
    category: `Sleep & Circadian Rhythm`,
  },
  {
    title: `Sleepiness as a Local Phenomenon`,
    authors: `Sasha D'Ambrosio`,
    year: 2019,
    description: `Sleep occupies a third of our life and is a primary need for all animal species studied so far.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Sleepiness as a Local Phenomenon.pdf`,
    sourceUrl: `https://doi.org/10.3389/fnins.2019.01086`,
    category: `Sleep & Circadian Rhythm`,
  },
  {
    title: `The aging clock  circadian rhythms and later life`,
    authors: ``,
    year: 2017,
    description: `Reviews how the circadian clock changes with aging — including reduced amplitude oscillations, phase advances, and fragmented sleep-wake cycles — and discusses the downstream consequences for metabolic health, cognitive function, and longevity in older adults.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/The aging clock_ circadian rhythms and later life.pdf`,
    sourceUrl: `https://doi.org/10.1172/jci90328`,
    category: `Sleep & Circadian Rhythm`,
  },
  {
    title: `The consequences of sleep deprivation on cognitive performance`,
    authors: ``,
    year: 2023,
    description: `Review focused on the biological explanation as well as the effects that sleep deprivation can have on cognition.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/The consequences of sleep deprivation on cognitive performan.pdf`,
    sourceUrl: `https://doi.org/10.17712/nsj.2023.2.20220108`,
    category: `Sleep & Circadian Rhythm`,
  },
  {
    title: `Time-Restricted Feeding Improves Circadian Dysfunction as well as Motor Symptoms in the Q175 Mouse Model of Huntington’s Disease`,
    authors: ``,
    year: 2018,
    description: `Huntington’s disease (HD) patients suffer from a progressive neurode- generation that results in cognitive, psychiatric, cardiovascular, and motor dysfunction. Disturbances in sleep/wake cycles are common among HD patients with reports of delayed sleep onset, frequent bedtime awaken- ings, and fatigue during the day. The heterozygous Q175 mouse model of HD has been shown to phenocopy many HD core`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Time-Restricted Feeding Improves Circadian Dysfunction as we.pdf`,
    sourceUrl: `https://doi.org/10.1523/eneuro.0431-17.2017`,
    category: `Sleep & Circadian Rhythm`,
  },
  {
    title: `Better, Virtually: the Past, Present, and Future of Virtual Reality Cognitive Behavior Therapy`,
    authors: `Philip Lindner`,
    year: 2020,
    description: `Virtual reality (VR) is an immersive technology capable of creating a powerful, perceptual illusion of being present in a virtual environment. VR technology has been used in cognitive behavior therapy since the 1990s and accumulated an impressive evidence base, yet with the recent release of consumer VR platforms came a true paradigm shift in the capabilities and scalability of VR for mental healt`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Better_ Virtually_ the Past_ Present_ and Future of Virtual.pdf`,
    sourceUrl: `https://doi.org/10.1007/s41811-020-00090-7`,
    category: `VR & Simulation`,
  },
  {
    title: `Towards immersive virtual reality (iVR): a route to surgical expertise`,
    authors: `Saurabh Dargar; Rebecca Kennedy; WeiXuan Lai; Venkata Arikatla; Suvranu De`,
    year: 2015,
    description: `Surgery is characterized by complex tasks performed in stressful environments. To enhance patient safety and reduce errors, surgeons must be trained in environments that mimic the actual clinical setting.`,
    url: `https://lens-pfp.s3.us-east-1.amazonaws.com/papers/Towards immersive virtual reality _iVR__ a route to surgical.pdf`,
    sourceUrl: `https://doi.org/10.1186/s40244-015-0015-8`,
    category: `VR & Simulation`,
  },
];

const CARDS_PER_CATEGORY = 2;

const isPdfUrl = (url: string) =>
  url.toLowerCase().includes('.pdf') || url.includes('amazonaws.com');

const Studies = () => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleCardClick = (study: Study) => {
    if (isPdfUrl(study.url)) {
      setViewerUrl(study.url);
    } else {
      window.open(study.url, '_blank', 'noopener,noreferrer');
    }
  };

  const categories = Array.from(new Set(studies.map((s) => s.category)));

  return (
    <div className="studies-page">

      <div className="studies-header">
        <h2 className="studies-page-title">Studies</h2>
        <p className="studies-page-sub">
          A curated collection of research on study habits, focus, memory, and performance.
          Click a card to read the paper.
        </p>
      </div>

      {categories.map((category) => {
        const categoryStudies = studies.filter((s) => s.category === category);
        const isExpanded = expandedCategories.has(category);
        const visible = isExpanded ? categoryStudies : categoryStudies.slice(0, CARDS_PER_CATEGORY);
        const hiddenCount = categoryStudies.length - CARDS_PER_CATEGORY;

        return (
          <section key={category} className="studies-category">
            <h3 className="studies-category-label">{category}</h3>
            <div className="studies-list">
              {visible.map((study) => (
                <div
                  key={study.title}
                  className="study-card"
                  onClick={() => handleCardClick(study)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleCardClick(study)}
                >
                  <div className="study-card-inner">
                    <div className="study-card-header">
                      <span className="study-category-badge">{study.category}</span>
                      <span className="study-year">{study.year || ''}</span>
                    </div>
                    <div className="study-title">{study.title}</div>
                    <div className="study-authors">{study.authors}</div>
                    <p className="study-description">{study.description}</p>
                    <div className="study-card-footer">
                      <div className="study-read-link">
                        {isPdfUrl(study.url) ? 'View paper' : 'Read study'}{' '}
                        <span className="study-arrow">→</span>
                      </div>
                      {study.sourceUrl && (
                        <a
                          href={study.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="study-source-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Original source ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hiddenCount > 0 && (
              <button
                className="studies-see-more"
                onClick={() => toggleCategory(category)}
              >
                {isExpanded ? 'Show less ↑' : `See ${hiddenCount} more →`}
              </button>
            )}
          </section>
        );
      })}

      {viewerUrl && (
        <div className="pdf-viewer-overlay" onClick={() => setViewerUrl(null)}>
          <div className="pdf-viewer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-viewer-toolbar">
              <a
                href={viewerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pdf-open-new-tab"
              >
                Open in new tab ↗
              </a>
              <button
                className="pdf-viewer-close"
                onClick={() => setViewerUrl(null)}
                aria-label="Close PDF viewer"
              >
                ×
              </button>
            </div>
            <iframe
              src={viewerUrl}
              className="pdf-viewer-frame"
              title="Research paper"
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default Studies;
