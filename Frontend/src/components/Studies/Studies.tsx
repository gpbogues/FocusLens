import './Studies.css';

interface Study {
  title: string;
  authors: string;
  year: number;
  description: string;
  url: string;
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
];

const categories = Array.from(new Set(studies.map((s) => s.category)));

const Studies = () => {
  return (
    <div className="studies-page">

      <div className="studies-header">
        <h2 className="studies-page-title">Studies</h2>
        <p className="studies-page-sub">
          A curated collection of research on study habits, focus, memory, and performance.
          Each entry links to the original paper.
        </p>
      </div>

      {categories.map((category) => (
        <section key={category} className="studies-category">
          <h3 className="studies-category-label">{category}</h3>
          <div className="studies-list">
            {studies
              .filter((s) => s.category === category)
              .map((study) => (
                <a
                  key={study.title}
                  href={study.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="study-card"
                >
                  <div className="study-card-inner">
                    <div className="study-card-header">
                      <span className="study-category-badge">{study.category}</span>
                      <span className="study-year">{study.year}</span>
                    </div>
                    <div className="study-title">{study.title}</div>
                    <div className="study-authors">{study.authors}</div>
                    <p className="study-description">{study.description}</p>
                    <div className="study-read-link">
                      Read study <span className="study-arrow">→</span>
                    </div>
                  </div>
                </a>
              ))}
          </div>
        </section>
      ))}

    </div>
  );
};

export default Studies;
