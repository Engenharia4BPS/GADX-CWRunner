import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Elemento #app não encontrado.");
}

app.innerHTML = `
  <main class="runner-shell" aria-label="Araucaria CW Runner">
    <header class="topbar">
      <div>
        <p class="eyebrow">ARAUCARIA DX · CW RUNNER</p>
        <h1>Entry Window</h1>
      </div>
      <div class="session-status"><span></span> PRÁTICA LOCAL</div>
    </header>

    <section class="entry-grid" aria-label="Registro de contato">
      <label class="callsign-field">CALL
        <input id="callsign" autocomplete="off" spellcheck="false" placeholder="PY5XXX" autofocus />
      </label>
      <label>RST<input value="599" aria-label="RST enviado" /></label>
      <label>NR<input value="001" aria-label="Número de série" /></label>
      <label>EXCH<input placeholder="DX" aria-label="Exchange" /></label>
    </section>

    <section class="controls" aria-label="Controles de treino">
      <button id="start-button" class="primary">INICIAR TREINO</button>
      <label class="wpm">WPM <input id="wpm" type="number" value="28" min="10" max="60" /></label>
      <label class="toggle"><input type="radio" name="operation" checked /> RUN</label>
      <label class="toggle"><input type="radio" name="operation" /> S&amp;P</label>
      <label class="toggle"><input type="checkbox" /> Pile-up</label>
    </section>

    <section class="macros" aria-label="Mensagens rápidas">
      <button>F1 CQ</button><button>F2 EXCH</button><button>F3 TU</button><button>F4 MY CALL</button>
      <button>F5 HIS CALL</button><button>F6 REPETIR</button><button>F7 ?</button><button>F8 AGAIN?</button>
      <button>F9 NR?</button><button>F10 CALL?</button><button>F11 EMPTY</button><button>F12 WIPE</button>
    </section>

    <section class="dashboard">
      <div class="panel">
        <h2>Taxa</h2>
        <strong id="rate">0</strong><span> QSOs/h</span>
      </div>
      <div class="panel">
        <h2>Log</h2>
        <strong id="qsos">0</strong><span> QSOs</span>
      </div>
      <div class="panel conditions">
        <h2>Condições</h2>
        <div><label>QRN <input type="range" min="0" max="10" value="1" /></label><label>QRM <input type="range" min="0" max="10" value="2" /></label></div>
      </div>
    </section>

    <footer id="feedback">Pronto. Clique em “Iniciar treino” para liberar o áudio no navegador.</footer>
  </main>
`;

const feedback = document.querySelector<HTMLElement>("#feedback");
const startButton = document.querySelector<HTMLButtonElement>("#start-button");
const callsign = document.querySelector<HTMLInputElement>("#callsign");

startButton?.addEventListener("click", () => {
  const wpm = document.querySelector<HTMLInputElement>("#wpm")?.value ?? "28";
  if (feedback) feedback.textContent = `Sessão local preparada em ${wpm} WPM. O gerador de áudio será o próximo módulo.`;
  callsign?.focus();
});

document.querySelectorAll<HTMLButtonElement>(".macros button").forEach((button) => {
  button.addEventListener("click", () => {
    if (feedback) feedback.textContent = `${button.textContent} selecionado — macro ainda será conectada ao motor CW.`;
  });
});
