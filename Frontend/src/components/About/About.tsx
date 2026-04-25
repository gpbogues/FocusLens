import './About.css';

const teamMembers = [
  'Gannon Bogues',
  'Sebastian Gu',
  'Brandon Charnell',
  'Faisal',
  'Preet Bhele',
];

const steps = [
  {
    number: '01',
    title: 'Start a Session',
    body: 'Hit "Start Session" on the home screen. Grant camera access when prompted — your feed is processed locally and never stored.',
  },
  {
    number: '02',
    title: 'Work Normally',
    body: "Work on whatever you need to. FocusLens runs in the background, quietly measuring your eye contact, attention, and deep focus states.",
  },
  {
    number: '03',
    title: 'Review Your Metrics',
    body: 'After your session ends, visit Metrics to see your focus score over time. Spot patterns and find the conditions where you work best.',
  },
  {
    number: '04',
    title: 'Organize Your History',
    body: 'Use Sessions to name, annotate, and folder your past sessions. Build a searchable archive of your work history.',
  },
];

const tips = [
  {
    title: 'Good Lighting',
    body: 'Make sure your face is well-lit from the front. Natural light or a desk lamp facing you helps the AI accurately read your focus signals. Avoid strong backlight from windows behind you.',
  },
  {
    title: 'Stay Centered',
    body: 'Position yourself so your face is roughly centered in the webcam frame. Sitting too far to one side or too far back reduces detection accuracy.',
  },
  {
    title: 'Run Longer Sessions',
    body: 'Sessions of 30 minutes or more give the system more data points to calculate meaningful averages and trends. Short sessions are still tracked, but longer ones tell a richer story.',
  },
];

const About = () => {
  return (
    <div className="about-page">

      {/* Hero */}
      <section className="about-hero">
        <div className="about-hero-eyebrow">FocusLens</div>
        <h1 className="about-hero-title">
          AI-powered focus tracking<br />for anyone at a computer.
        </h1>
        <p className="about-hero-sub">
          Stop guessing how well you worked. FocusLens uses your webcam to measure focus in real
          time — so you can understand your attention, build better habits, and get more out of
          every session.
        </p>
      </section>

      {/* What is FocusLens */}
      <section className="about-section">
        <h2 className="about-section-label">What is FocusLens?</h2>
        <div className="about-text-block">
          <p>
            FocusLens is a lightweight tool that runs alongside your work. It uses your computer's
            camera and an AI vision model to passively monitor focus signals — things like eye
            contact with your screen, head position, and sustained attention — and turns them into
            a continuous focus score.
          </p>
          <p>
            That score is logged over each session, giving you a data-backed picture of your work
            habits that you can review, organize, and track over time. No manual input. No
            interruptions. Just honest numbers about how your sessions actually went.
          </p>
        </div>
      </section>

      {/* Why it matters */}
      <section className="about-section">
        <h2 className="about-section-label">Why it matters</h2>
        <div className="about-cards">
          <div className="about-card">
            <div className="about-card-eyebrow">The Problem</div>
            <p className="about-card-body">
              Most people overestimate how focused they actually are. Hours at a desk don't equal
              hours of real work — and without data, it's nearly impossible to know the difference.
            </p>
          </div>
          <div className="about-card">
            <div className="about-card-eyebrow">The Insight</div>
            <p className="about-card-body">
              Research consistently shows that understanding your own performance patterns is one of
              the most reliable ways to improve them. Awareness is the first step to change.
            </p>
          </div>
          <div className="about-card">
            <div className="about-card-eyebrow">The Solution</div>
            <p className="about-card-body">
              FocusLens gives you objective, passive feedback — no self-reporting, no guessing.
              Use it to find when you work best, spot distractions, and build a record of
              consistent effort.
            </p>
          </div>
        </div>
      </section>

      {/* How to use it */}
      <section className="about-section">
        <h2 className="about-section-label">How to use it</h2>
        <div className="about-steps">
          {steps.map((step) => (
            <div key={step.number} className="about-step">
              <div className="about-step-number">{step.number}</div>
              <div className="about-step-content">
                <div className="about-step-title">{step.title}</div>
                <p className="about-step-body">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="about-section">
        <h2 className="about-section-label">Getting the most out of it</h2>
        <div className="about-tips">
          {tips.map((tip) => (
            <div key={tip.title} className="about-tip">
              <div className="about-tip-title">{tip.title}</div>
              <p className="about-tip-body">{tip.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="about-section about-section--last">
        <h2 className="about-section-label">The team</h2>
        <div className="about-team">
          {teamMembers.map((name) => (
            <div key={name} className="about-team-member">
              <div className="about-team-avatar">{name.charAt(0)}</div>
              <span className="about-team-name">{name}</span>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
};

export default About;
