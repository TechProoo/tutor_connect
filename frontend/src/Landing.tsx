import tcIcon from './assets/tc-icon.png'
import heroPhoto from './assets/hero-photo.png'
import './Landing.css'

function Sparkles({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 140 140" fill="none" aria-hidden="true">
      <path d="M40 0v140M104 0v140M0 36h140M0 100h140" stroke="#111827" strokeWidth="1" opacity="0.55" />
      <path d="M40 24l4 12 12 4-12 4-4 12-4-12-12-4 12-4 4-12Z" fill="#111827" />
      <path d="M104 88l4 12 12 4-12 4-4 12-4-12-12-4 12-4 4-12Z" fill="#111827" />
      <path d="M104 24l2.6 8 8 2.6-8 2.6-2.6 8-2.6-8-8-2.6 8-2.6 2.6-8Z" fill="#111827" />
    </svg>
  )
}

function Landing() {
  return (
    <div className="tc-page">
      <div className="tc-frame">
        <nav className="tc-nav">
          <a href="#" className="tc-brand">
            <img src={tcIcon} alt="TutorConnect" className="tc-brand-icon" />
            <span className="tc-brand-name">
              <span className="tc-brand-navy">Tutor</span>
              {' '}
              <span className="tc-brand-orange">Connect</span>
            </span>
          </a>
          <div className="tc-nav-actions">
            <a href="#/survey" className="tc-btn-signup">
              Start survey
            </a>
          </div>
        </nav>

        <div className="tc-hero">
          <div className="tc-hero-copy">
            <h1 className="tc-headline">
              Help us build
              <br />
              <span className="tc-highlight tc-highlight-top">a better way</span>{' '}
              to
              <br />
              <span className="tc-highlight tc-highlight-bottom">learn and earn</span>
              <br />
              on campus.
            </h1>
            <p className="tc-subhead">
              Help us build Tutor Connect by sharing your feedback. Whether
              you’re looking for a tutor or ready to earn by teaching others,
              your responses will help shape the platform.
            </p>
            <div className="tc-cta-row">
              <a href="#/survey" className="tc-btn-primary">
                Start survey <span className="tc-arrow">↗</span>
              </a>
              <div className="tc-stat-circle">
                <div className="tc-stat-number">Built for</div>
                <div className="tc-stat-label">your campus</div>
              </div>
            </div>
            <div className="tc-campuses">
              <span>Built from real student insights.</span>
            </div>
          </div>

          <div className="tc-hero-visual">
            <Sparkles className="tc-spark tc-spark-tr" />
            <Sparkles className="tc-spark tc-spark-ml" />

            <div className="tc-badge-spin">
              <svg viewBox="0 0 100 100" className="tc-spin-svg">
                <defs>
                  <path
                    id="tccirc"
                    d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0"
                  />
                </defs>
                <text
                  fontSize="9.4"
                  fontWeight="700"
                  letterSpacing="1.2"
                  fill="#1A3A5C"
                  fontFamily="'Plus Jakarta Sans',sans-serif"
                >
                  <textPath href="#tccirc">learn better · achieve more · </textPath>
                </text>
              </svg>
              <div className="tc-spin-center">↗</div>
            </div>

            <div className="tc-photo-frame">
              <img src={heroPhoto} alt="A TutorConnect peer tutor" />
            </div>

            <div className="tc-tag-tutor">Made with students</div>
            <div className="tc-photo-dots">○○○</div>
            <div className="tc-tag-avg">2 MIN</div>

            <div className="tc-pill-video">
              <div className="tc-avatar-stack">
                <span className="tc-avatar-sm tc-bg-orange">T</span>
                <span className="tc-avatar-sm tc-bg-navy">K</span>
                <span className="tc-avatar-sm tc-bg-slate">N</span>
              </div>
              <span className="tc-pill-label">Why your input matters</span>
              <span className="tc-play">▶</span>
            </div>

            <div className="tc-card-grades">
              <div className="tc-card-title">
                Help shape campus tutoring
              </div>
              <div className="tc-card-person">
                <span className="tc-avatar tc-avatar-navy">T</span>Student survey
              </div>
              <div className="tc-card-row">
                <span className="tc-card-metric">Your experience</span>
                <span className="tc-card-value">matters</span>
              </div>
              <div className="tc-card-more">
                Start survey <span className="tc-dots">•••</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Landing
