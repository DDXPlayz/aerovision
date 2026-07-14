import React, { useEffect, useRef } from 'react';
import { initAeroVision } from './main';
import { Navbar } from '@anantam/ui';

export default function App() {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      // Boot the legacy vanilla JS app exactly once
      initAeroVision();
    }
  }, []);

  return (
    <>
      <div id="stage"></div>
      <div id="racegrid"></div>
      <div id="grain"></div>

      <Navbar appTitle="AeroVision" />

      <main id="scroll">
        <section className="panel center" data-scene="hero" id="hero">
          <div className="eyebrow reveal">Anantam · AeroVision</div>
          <h1 className="reveal d1">See the<br/>invisible.</h1>
          <p className="lede reveal d2">
            Aerodynamics, rendered in your browser. Upload a car and watch the air decide how fast it really is.
          </p>
          <div className="cue reveal d3" id="cue"><span>Scroll</span><i></i></div>
        </section>
        
        <section className="panel" data-scene="problem" id="problem">
          <div className="col">
            <div className="eyebrow reveal">Engineering software, today</div>
            <h2 className="reveal d1">Built for<br/>experts only.</h2>
            <p className="lede reveal d2">
              Tables. Menus. Queues. Waiting. We rebuilt the feeling from zero — so understanding air takes a scroll, not a manual.
            </p>
          </div>
        </section>
        
        <section className="panel center" data-scene="manifesto" id="manifesto">
          <p className="statement reveal">
            Not a simpler CFD tool.<br/>
            <span className="dim">A new way to</span> <span className="accent">feel aerodynamics.</span>
          </p>
        </section>
        
        <section className="panel" data-scene="flow" id="s-flow">
          <div className="col">
            <div className="eyebrow reveal">01 — Airflow</div>
            <h2 className="reveal d1">Streamlines,<br/>not guesswork.</h2>
            <p className="lede reveal d2">
              Continuous flow lines wrap the body, split around wings, curl into vortices behind sharp edges, and release into the wake — velocity you can read at a glance.
            </p>
          </div>
        </section>
        
        <section className="panel" data-scene="pressure" id="s-pressure">
          <div className="col right">
            <div className="eyebrow reveal">02 — Pressure</div>
            <h2 className="reveal d1">Where the<br/>load lives.</h2>
            <p className="lede reveal d2">
              Every surface paints itself, stagnation red to low-pressure blue, turning downforce and drag into something you can see.
            </p>
            <div className="legend reveal d3"><span>Low</span><i className="ramp"></i><span>High</span></div>
          </div>
        </section>
        
        <section className="panel" data-scene="engine" id="s-engine">
          <div className="col">
            <div className="eyebrow reveal">03 — Engineering</div>
            <h2 className="reveal d1">Believable<br/>by design.</h2>
            <p className="lede reveal d2">
              A deterministic model reads your geometry and estimates performance under STEM Racing conditions — a 20-metre track and an 8-gram CO₂ charge. An approximation, grounded in engineering. Never a claim of true CFD.
            </p>
          </div>
        </section>
        
        <section className="panel center" data-scene="launch" id="launch">
          <div className="eyebrow reveal">Your turn</div>
          <h2 className="reveal d1">Bring your<br/>own car.</h2>
          <button className="drop reveal d2" id="drop" type="button">
            <span className="drop-ring"></span>
            <span className="drop-title">Drop your model to begin</span>
            <span className="drop-sub">or click to choose a file</span>
            <span className="drop-formats"><b>OBJ</b><b>GLB</b><b>GLTF</b><b>STL</b></span>
            <input type="file" id="file" accept=".obj,.glb,.gltf,.stl" hidden />
          </button>
          <p className="fine reveal d3">
            Runs entirely on your machine. Your geometry never leaves this browser. This is a visual aerodynamic estimate, not a replacement for professional CFD.
          </p>
        </section>
      </main>

      {/* Scene progress dots */}
      <nav id="sceneDots" aria-label="Scene navigation">
        <button data-scene-idx="0" className="dot active" aria-label="Scene 1"></button>
        <button data-scene-idx="1" className="dot" aria-label="Scene 2"></button>
        <button data-scene-idx="2" className="dot" aria-label="Scene 3"></button>
        <button data-scene-idx="3" className="dot" aria-label="Scene 4"></button>
        <button data-scene-idx="4" className="dot" aria-label="Scene 5"></button>
        <button data-scene-idx="5" className="dot" aria-label="Scene 6"></button>
        <button data-scene-idx="6" className="dot" aria-label="Scene 7"></button>
        <button data-scene-idx="7" className="dot" aria-label="Footer"></button>
      </nav>

      <footer id="foot">
        <div className="foot-glow-line"></div>
        <div className="foot-grid">
          <div className="foot-col">
            <div className="brand small">ANANTAM<span>.</span></div>
            <div className="brand-sub">Aero Vision</div>
            <p className="foot-text">Advanced aerodynamic visualization and telemetry suite engineered for Team Anantam Racing.</p>
          </div>
          <div className="foot-col">
            <div className="foot-label">System Specs</div>
            <p className="foot-text">Core Engine: STEM Racing Engine v3.5<br/>Graphics: WebGL 2.0 / Three.js r128<br/>Shader Pipeline: High-Precision GLSL ES</p>
          </div>
          <div className="foot-col">
            <div className="foot-label">Technical Metadata</div>
            <p className="foot-text">Determinism: Strict geometric bounding<br/>CFD Approximation: Navier-Stokes projection<br/>Resolution: Sub-millimeter boundary sweep</p>
          </div>
          <div className="foot-col right">
            <div className="foot-label">Build Info</div>
            <p className="foot-text">Stable Release: v2.4.8-rc1<br/>Ref: ANANTAM-AERO-2026<br/>Status: Operational</p>
          </div>
        </div>
        <div className="foot-bottom">
          <div className="foot-credits">© 2026 Team Anantam Racing. All rights reserved. For engineering use only.</div>
          <div className="foot-links">
            <a href="#hero">Overview</a>
            <span className="dot">·</span>
            <a href="#manifesto">Manifesto</a>
            <span className="dot">·</span>
            <a href="#launch">Studio</a>
          </div>
        </div>
      </footer>

      <div id="studio" aria-hidden="true">
        <aside className="hud-panel">
          <div className="hud-card">
            <div className="hud-top">
              <div className="hud-id">
                <span className="live">Live</span>
                <div className="eyebrow">Aerodynamic profile</div>
                <h3 id="modelName">Your model</h3>
                <span id="modelSub" className="hud-meta">Deterministic estimate · in-browser</span>
              </div>
              <button className="ghost" id="closeStudio" type="button">Exit</button>
            </div>
          </div>
          
          <div className="hud-card">
            <div className="hud-label">Aero Performance Score</div>
            <div className="score">
              <div className="score-k">Aero score</div>
              <div className="score-v"><span id="scoreVal">0</span><small>/100</small></div>
              <div className="score-bar"><i id="scoreBar"></i></div>
              <div className="score-note" id="scoreNote">STEM Racing conditions</div>
            </div>
            <div className="subs" id="subs">
              <div className="sub"><span>Efficiency</span><i><b data-sub="eff"></b></i></div>
              <div className="sub"><span>Downforce</span><i><b data-sub="df"></b></i></div>
              <div className="sub"><span>Flow</span><i><b data-sub="flow"></b></i></div>
              <div className="sub"><span>Stability</span><i><b data-sub="stab"></b></i></div>
            </div>
          </div>
          
          <div className="hud-card">
            <div className="hud-label">Performance Metrics</div>
            <div className="metrics" id="metrics">
              <div className="metric">
                <div className="k">Drag coefficient</div>
                <div className="v" data-metric="cd">—</div>
              </div>
              <div className="metric">
                <div className="k">20 m run time</div>
                <div className="v" data-metric="time">—</div>
              </div>
              <div className="metric">
                <div className="k">Top speed</div>
                <div className="v" data-metric="top">—</div>
              </div>
              <div className="metric">
                <div className="k">Frontal area</div>
                <div className="v" data-metric="fa">—</div>
              </div>
              <div className="metric">
                <div className="k">Downforce index</div>
                <div className="v" data-metric="df">—</div>
              </div>
              <div className="metric">
                <div className="k">Flow attachment</div>
                <div className="v" data-metric="flowq">—</div>
              </div>
            </div>
          </div>
          
          <div className="hud-card">
            <div className="dock">
              <div className="dock-label">Render mode</div>
              <div className="seg" id="viewSeg">
                <button data-view="airflow" className="on">Airflow</button>
                <button data-view="pressure">Pressure</button>
                <button data-view="wake">Wake</button>
                <button data-view="wire">Wireframe</button>
              </div>
              <div className="dock-label">Camera</div>
              <div className="cams" id="cams">
                <button data-cam="hero" className="on">Hero</button>
                <button data-cam="front">Front</button>
                <button data-cam="side">Side</button>
                <button data-cam="top">Top</button>
                <button data-cam="chase">Chase</button>
              </div>
              <div className="tools">
                <button id="openReport" className="tool" type="button">Engineering report</button>
                <button id="capture" className="tool ghosty" type="button">Capture</button>
              </div>
              <div className="dock-hint">Drag to orbit · scroll to zoom</div>
            </div>
          </div>
        </aside>
      </div>

      <div id="report" aria-hidden="true">
        <div className="report-card">
          <button className="report-close" id="closeReport" type="button">✕</button>
          <div className="report-head">
            <div>
              <div className="eyebrow">Engineering report</div>
              <h3 id="repTitle">Model</h3>
              <span className="hud-meta" id="repVerdict">—</span>
            </div>
            <div className="report-score"><span id="repScore">0</span><small>/100</small></div>
          </div>
          <div className="report-viz">
            <div className="report-radar" id="repRadar"></div>
            <div className="report-subs" id="repSubs"></div>
          </div>
          <div className="report-specs">
            <h4>Geometry &amp; simulation</h4>
            <div className="spec-grid" id="repSpecs"></div>
          </div>
          <div className="report-cols">
            <div className="report-col">
              <h4>Strengths</h4>
              <ul id="repStrengths"></ul>
            </div>
            <div className="report-col">
              <h4>Issues</h4>
              <ul id="repIssues"></ul>
            </div>
          </div>
          <div className="report-recs">
            <h4>Recommended changes</h4>
            <ol id="repRecs"></ol>
          </div>
          <div className="report-foot">
            Generated from deterministic geometry analysis under STEM Racing conditions — engineering guidance, not certified CFD.
          </div>
        </div>
      </div>

      <div id="scanner" aria-hidden="true">
        <div className="scan">
          <div className="scan-top"><span>Analyzing geometry</span><span id="scanPct">0%</span></div>
          <div className="scan-track"><i id="scanFill"></i></div>
          <div className="scan-step" id="scanStep">Reading surface…</div>
        </div>
      </div>

      <div id="boot">
        <div className="b-brand">ANANTAM<span>.</span></div>
        <div className="b-bar"><i></i></div>
        <div className="b-err" id="bootErr"></div>
      </div>
    </>
  );
}
