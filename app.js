// =========================
// CONFIGURAÇÃO DO SISTEMA
// =========================

// Firebase (já vem das tags do index.html: firebase-app.js e firebase-database.js)
const firebaseConfig = {
  apiKey: "AIzaSyAX31GLvb9uJaA9YqhyTwgl02OGAAjuDp4",
  authDomain: "novasaude-rh.firebaseapp.com",
  databaseURL: "https://novasaude-rh-default-rtdb.firebaseio.com",
  projectId: "novasaude-rh",
  storageBucket: "novasaude-rh.firebasestorage.app",
  messagingSenderId: "425478661304",
  appId: "1:425478661304:web:b8fa21e4e20da247d6404d"
};
// [web:259][web:301]

const SUPABASE_URL = "https://iigbyjilesdyaqusevdk.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpZ2J5amlsZXNkeWFxdXNldmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNjc5MjgsImV4cCI6MjA3OTg0MzkyOH0.W-VI0ANZwFqVrzEGoPX1bUVRhvqo_6Bo0bSCpp8fVWU";
// [web:276][web:304]

// Caminhos no Realtime Database
const PATH_USERS = "/users";
const PATH_EMPLOYEES = "/employees";

// Objeto global
const AppCore = {
  firebaseApp: null,
  db: null,
  supabase: null,
  currentUser: null, // { userId, username, perfil, departamento, employeeId }
  refreshIntervalId: null,
  currentViewId: "view-dashboard"
};

// =========================
// INICIALIZAÇÃO
// =========================

function initApp() {
  // Firebase
  if (!AppCore.firebaseApp) {
    AppCore.firebaseApp = firebase.initializeApp(firebaseConfig);
    AppCore.db = firebase.database();
  }

  // Supabase
  if (!AppCore.supabase) {
    AppCore.supabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
  }

  // Recupera usuário salvo
  const stored = localStorage.getItem("novaSaudeUser");
  if (stored) {
    try {
      AppCore.currentUser = JSON.parse(stored);
    } catch (e) {
      AppCore.currentUser = null;
    }
  }

  // Liga eventos da interface
  bindUIEvents();

  // Decide tela inicial
  if (AppCore.currentUser) {
    showAppShell();
  } else {
    showLogin();
  }

  // Auto refresh a cada 10 segundos
  startAutoRefresh(10000);
}

// =========================
// FUNÇÕES AUXILIARES
// =========================

function dbRef(path) {
  return AppCore.db.ref(path);
}

function dbGet(path) {
  return dbRef(path)
    .once("value")
    .then((snap) => snap.val());
} // [web:301]

function dbUpdate(path, data) {
  return dbRef(path).update(data);
}

function dbSet(path, data) {
  return dbRef(path).set(data);
}

function generateId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function hashSenha(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return "h" + Math.abs(h);
}

// Modal simples
function showModal(titulo, mensagem) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-box">
        <h3>${titulo}</h3>
        <p style="font-size:13px;">${mensagem}</p>
        <div style="text-align:right;margin-top:12px;">
          <button id="modal-ok" class="btn">OK</button>
        </div>
      </div>
    </div>
  `;
  root.classList.remove("hidden");
  document.getElementById("modal-ok").onclick = () => {
    root.classList.add("hidden");
    root.innerHTML = "";
  };
}

// =========================
// LOGIN LOCAL
// =========================

async function loginLocal(username, password) {
  const usuarios = (await dbGet(PATH_USERS)) || {};
  const senhaHash = hashSenha(password);

  let foundId = null;
  let foundUser = null;

  Object.keys(usuarios).forEach((id) => {
    const u = usuarios[id];
    if (u.username === username && u.passwordHash === senhaHash) {
      foundId = id;
      foundUser = u;
    }
  });

  if (!foundId) {
    throw new Error("Usuário ou senha inválidos.");
  }

  AppCore.currentUser = {
    userId: foundId,
    username: foundUser.username,
    perfil: foundUser.perfil,
    departamento: foundUser.departamento || "",
    employeeId: foundUser.employeeId || foundId
  };

  localStorage.setItem("novaSaudeUser", JSON.stringify(AppCore.currentUser));
  return AppCore.currentUser;
}

function logoutLocal() {
  AppCore.currentUser = null;
  localStorage.removeItem("novaSaudeUser");
  showLogin();
}

// =========================
// NAVEGAÇÃO ENTRE SEÇÕES
// =========================

function showLogin() {
  document.getElementById("page-login").classList.add("active");
  document.getElementById("page-login").classList.remove("hidden");

  document.getElementById("page-app").classList.add("hidden");
  document.getElementById("page-app").classList.remove("active");
}

function showAppShell() {
  document.getElementById("page-login").classList.add("hidden");
  document.getElementById("page-login").classList.remove("active");

  document.getElementById("page-app").classList.add("active");
  document.getElementById("page-app").classList.remove("hidden");

  const label = document.getElementById("header-user-label");
  if (AppCore.currentUser) {
    label.textContent = `${AppCore.currentUser.username} (${AppCore.currentUser.perfil})`;
  } else {
    label.textContent = "";
  }

  // Começa na tela de dashboard
  navigateTo("view-dashboard");
  refreshCurrentView();
}

function navigateTo(viewId) {
  const sections = document.querySelectorAll("#page-app .page-section");
  sections.forEach((sec) => {
    if (sec.id === viewId) {
      sec.classList.add("active");
      sec.classList.remove("hidden");
    } else if (sec.id !== "view-dashboard") {
      // Dashboard é uma section, mas tratamos como view também
      sec.classList.remove("active");
      sec.classList.add("hidden");
    }
  });

  if (viewId === "view-dashboard") {
    document.getElementById("view-dashboard").classList.add("active");
    document.getElementById("view-dashboard").classList.remove("hidden");
  } else {
    document.getElementById("view-dashboard").classList.remove("active");
  }

  AppCore.currentViewId = viewId;
  refreshCurrentView();
}

// =========================
// AUTO REFRESH
// =========================

function refreshCurrentView() {
  switch (AppCore.currentViewId) {
    case "view-dashboard":
      loadDashboardData();
      break;
    case "view-gestao-equipe":
      loadGestaoEquipe();
      break;
    case "view-relacao-func":
      loadRelacaoFuncionarios();
      break;
    case "view-meus-dados":
      loadMeusDados();
      break;
    case "view-minhas-ferias":
      loadMinhasFerias();
      break;
    case "view-escala":
      loadEscala();
      break;
    // As demais telas (férias gestão, avaliações, feedback, etc.) podem ter suas funções
    default:
      break;
  }

  // Notificações sempre atualizadas
  loadNotificacoes();
}

function startAutoRefresh(intervalMs) {
  if (AppCore.refreshIntervalId) {
    clearInterval(AppCore.refreshIntervalId);
  }
  AppCore.refreshIntervalId = setInterval(() => {
    if (AppCore.currentUser) {
      refreshCurrentView();
    }
  }, intervalMs);
} // [web:272][web:299][web:311]

// =========================
// BIND DE EVENTOS DA UI
// =========================

function bindUIEvents() {
  // Login
  const btnLogin = document.getElementById("btn-login");
  const loginMsg = document.getElementById("login-message");

  btnLogin.onclick = async () => {
    const user = document.getElementById("login-username").value.trim();
    const pass = document.getElementById("login-password").value;

    if (!user || !pass) {
      loginMsg.textContent = "Informe usuário e senha.";
      return;
    }

    btnLogin.disabled = true;
    loginMsg.textContent = "Entrando...";

    try {
      await loginLocal(user, pass);
      document.getElementById("login-password").value = "";
      loginMsg.textContent = "";
      showAppShell();
    } catch (e) {
      console.error(e);
      loginMsg.textContent = "Usuário ou senha inválidos.";
    } finally {
      btnLogin.disabled = false;
    }
  };

  // Logout
  document.getElementById("btn-logout").onclick = () => {
    logoutLocal();
  };

  // Botão atualizar
  document.getElementById("btn-refresh").onclick = () => {
    if (AppCore.currentUser) {
      refreshCurrentView();
      showModal("Atualização", "Dados atualizados com sucesso.");
    }
  };

  // Navegação via data-nav
  const navButtons = document.querySelectorAll("[data-nav]");
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-nav");
      navigateTo(target);
    });
  });

  // Notificações
  const notifBtn = document.getElementById("btn-notificacoes");
  const notifPanel = document.getElementById("notif-panel");
  notifBtn.onclick = () => {
    notifPanel.classList.toggle("hidden");
  };

  // Salvar colaborador
  const btnSalvarColab = document.getElementById("btn-salvar-colaborador");
  btnSalvarColab.onclick = onSalvarColaborador;

  // Escala: gerar / imprimir
  document.getElementById("btn-gerar-escala").onclick = () => {
    loadEscala();
  };
  document.getElementById("btn-imprimir-escala").onclick = () => {
    window.print();
  };
}

// =========================
// MÓDULO: DASHBOARD
// =========================

async function loadDashboardData() {
  // Aqui você pode montar pequenos cards (qtd de colaboradores, férias pendentes, etc.)
  // Por ora, mantém simples.
}

// =========================
// MÓDULO: GESTÃO DE EQUIPE
// =========================

async function loadGestaoEquipe() {
  const tabelaBody = document.querySelector("#tabela-colaboradores tbody");
  tabelaBody.innerHTML = "<tr><td colspan='5'>Carregando...</td></tr>";

  const allEmployees = (await dbGet(PATH_EMPLOYEES)) || {};

  const filtroNome = document
    .getElementById("filtro-equipe-nome")
    .value.toLowerCase();

  const rows = [];

  Object.keys(allEmployees).forEach((id) => {
    const c = allEmployees[id];
    if (filtroNome && !c.nome.toLowerCase().includes(filtroNome)) {
      return;
    }

    rows.push(`
      <tr data-id="${id}">
        <td>${c.nome || ""}</td>
        <td>${c.setor || ""}</td>
        <td>${c.cargo || ""}</td>
        <td>${c.status || ""}</td>
        <td>
          <button class="btn btn-secondary btn-sm" data-acao="editar">Editar</button>
        </td>
      </tr>
    `);
  });

  if (!rows.length) {
    tabelaBody.innerHTML = "<tr><td colspan='5'>Nenhum colaborador.</td></tr>";
  } else {
    tabelaBody.innerHTML = rows.join("");
  }

  // Evento de clique em editar
  tabelaBody.querySelectorAll("button[data-acao='editar']").forEach((b) => {
    b.onclick = async () => {
      const tr = b.closest("tr");
      const id = tr.getAttribute("data-id");
      await carregarColaboradorNoFormulario(id);
    };
  });

  // Filtro por nome
  document
    .getElementById("filtro-equipe-nome")
    .addEventListener("input", () => loadGestaoEquipe());
}

async function carregarColaboradorNoFormulario(userId) {
  const c = await dbGet(`${PATH_EMPLOYEES}/${userId}`);
  if (!c) return;

  document.getElementById("colab-id").value = userId;
  document.getElementById("colab-nome").value = c.nome || "";
  document.getElementById("colab-cpf").value = c.cpf || "";
  document.getElementById("colab-data-nasc").value = c.dataNascimento || "";
  document.getElementById("colab-cargo").value = c.cargo || "";
  document.getElementById("colab-setor").value = c.setor || "";
  document.getElementById("colab-data-adm").value = c.dataAdmissao || "";
  document.getElementById("colab-status").value = c.status || "ativo";
}

async function onSalvarColaborador() {
  if (!AppCore.currentUser) {
    showModal("Erro", "É necessário estar logado para salvar.");
    return;
  }

  const idCampo = document.getElementById("colab-id");
  const nome = document.getElementById("colab-nome").value.trim();
  const cpf = document.getElementById("colab-cpf").value.trim();
  const dataNasc = document.getElementById("colab-data-nasc").value;
  const cargo = document.getElementById("colab-cargo").value.trim();
  const setor = document.getElementById("colab-setor").value.trim();
  const dataAdm = document.getElementById("colab-data-adm").value;
  const status = document.getElementById("colab-status").value;
  const usuario = document.getElementById("colab-usuario").value.trim();
  const senha = document.getElementById("colab-senha").value;
  const perfil = document.getElementById("colab-perfil").value;
  const departamento = document.getElementById("colab-departamento").value;
  const fotoFile = document.getElementById("colab-foto").files[0];

  if (!nome || !usuario || (!idCampo.value && !senha)) {
    showModal(
      "Campos obrigatórios",
      "Informe ao menos nome, usuário e senha (para novo colaborador)."
    );
    return;
  }

  try {
    let userId = idCampo.value || generateId("user");

    // Monta dados de usuário
    const userData = {
      username: usuario,
      perfil,
      departamento,
      employeeId: userId
    };

    if (!idCampo.value) {
      userData.passwordHash = hashSenha(senha);
      userData.createdAt = Date.now();
    }

    // Monta dados de colaborador
    const colabData = {
      id: userId,
      nome,
      cpf,
      dataNascimento: dataNasc,
      cargo,
      setor,
      dataAdmissao: dataAdm,
      status: status || "ativo",
      updatedAt: Date.now()
    };

    // Se for novo
    if (!idCampo.value) {
      colabData.createdAt = Date.now();
    }

    const updates = {};
    updates[`${PATH_USERS}/${userId}`] = {
      ...(await dbGet(`${PATH_USERS}/${userId}`)),
      ...userData
    };
    updates[`${PATH_EMPLOYEES}/${userId}`] = {
      ...(await dbGet(`${PATH_EMPLOYEES}/${userId}`)),
      ...colabData
    };

    await AppCore.db.ref().update(updates);

    // Upload da foto, se houver
    if (fotoFile) {
      await uploadFotoColaborador(userId, fotoFile);
    }

    showModal("Sucesso", "Colaborador salvo com sucesso.");
    document.getElementById("colab-senha").value = "";
    idCampo.value = userId;
    await loadGestaoEquipe();
  } catch (e) {
    console.error(e);
    showModal("Erro", "Não foi possível salvar o colaborador.");
  }
}

async function uploadFotoColaborador(userId, file) {
  const filePath = `employees/${userId}/foto.jpg`;

  const { data, error } = await AppCore.supabase.storage
    .from("novasaude-rh")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type || "image/jpeg"
    }); // [web:144][web:318]

  if (error) {
    console.error(error);
    throw new Error("Erro ao enviar foto.");
  }

  const { data: pub } = AppCore.supabase.storage
    .from("novasaude-rh")
    .getPublicUrl(filePath);

  const url = pub?.publicUrl || "";
  if (url) {
    await dbUpdate(`${PATH_EMPLOYEES}/${userId}`, { fotoUrl: url });
  }
}

// =========================
// RELAÇÃO DE FUNCIONÁRIOS
// =========================

async function loadRelacaoFuncionarios() {
  const tbody = document.querySelector("#tabela-relacao-func tbody");
  tbody.innerHTML = "<tr><td colspan='5'>Carregando...</td></tr>";

  const allEmployees = (await dbGet(PATH_EMPLOYEES)) || {};
  const rows = [];

  Object.keys(allEmployees).forEach((id) => {
    const c = allEmployees[id];
    rows.push(`
      <tr>
        <td>${c.nome || ""}</td>
        <td>${c.cpf || ""}</td>
        <td>${c.cargo || ""}</td>
        <td>${c.setor || ""}</td>
        <td>${c.status || ""}</td>
      </tr>
    `);
  });

  if (!rows.length) {
    tbody.innerHTML = "<tr><td colspan='5'>Nenhum colaborador.</td></tr>";
  } else {
    tbody.innerHTML = rows.join("");
  }
}

// =========================
// MEUS DADOS / MINHAS FÉRIAS
// =========================

async function loadMeusDados() {
  if (!AppCore.currentUser) return;
  const container = document.getElementById("meus-dados-container");
  container.innerHTML = "Carregando...";

  const c = await dbGet(`${PATH_EMPLOYEES}/${AppCore.currentUser.employeeId}`);
  if (!c) {
    container.innerHTML = "Nenhum dado encontrado.";
    return;
  }

  container.innerHTML = `
    <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">
      <div>
        <div style="width:140px;height:180px;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;background:#f9fafb;">
          ${
            c.fotoUrl
              ? `<img src="${c.fotoUrl}" alt="Foto" style="max-width:100%;max-height:100%;object-fit:cover;">`
              : "<span style='font-size:12px;color:#9ca3af;'>Sem foto</span>"
          }
        </div>
      </div>
      <div>
        <h3 style="margin-top:0;">${c.nome || ""}</h3>
        <p style="font-size:13px;margin:4px 0;">CPF: ${c.cpf || "-"}</p>
        <p style="font-size:13px;margin:4px 0;">Cargo: ${
          c.cargo || "-"
        }</p>
        <p style="font-size:13px;margin:4px 0;">Departamento: ${
          c.setor || "-"
        }</p>
        <p style="font-size:13px;margin:4px 0;">Admissão: ${
          c.dataAdmissao || "-"
        }</p>
        <p style="font-size:13px;margin:4px 0;">Status: ${
          c.status || "-"
        }</p>
      </div>
    </div>
  `;
}

async function loadMinhasFerias() {
  // Estrutura de férias ainda será detalhada; aqui apenas um placeholder.
  const container = document.getElementById("minhas-ferias-container");
  container.innerHTML =
    "<p style='font-size:13px;'>Módulo de férias será detalhado na próxima etapa (sugestão, saldo, bloqueio 45 dias, etc.).</p>";
}

// =========================
// ESCALA (ESQUELETO)
// =========================

async function loadEscala() {
  const container = document.getElementById("escala-container");
  const mesInput = document.getElementById("escala-mes").value;

  if (!mesInput) {
    container.innerHTML =
      "<p style='font-size:13px;'>Selecione um mês para gerar a escala.</p>";
    return;
  }

  // Por enquanto, apenas mostra uma tabela simples com datas do mês
  const [anoStr, mesStr] = mesInput.split("-");
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);

  const diasNoMes = new Date(ano, mes, 0).getDate();

  const allEmployees = (await dbGet(PATH_EMPLOYEES)) || {};

  let thead = "<tr><th>Colaborador</th>";
  for (let d = 1; d <= diasNoMes; d++) {
    thead += `<th>${d}</th>`;
  }
  thead += "</tr>";

  const linhas = [];

  Object.keys(allEmployees).forEach((id) => {
    const c = allEmployees[id];
    let row = `<tr><td>${c.nome || ""}</td>`;
    for (let d = 1; d <= diasNoMes; d++) {
      row += "<td></td>"; // Futuro: preencher com F, FE, AT etc.
    }
    row += "</tr>";
    linhas.push(row);
  });

  if (!linhas.length) {
    container.innerHTML =
      "<p style='font-size:13px;'>Não há colaboradores cadastrados para montar a escala.</p>";
    return;
  }

  container.innerHTML = `
    <table class="table">
      <thead>${thead}</thead>
      <tbody>${linhas.join("")}</tbody>
    </table>
  `;
}

// =========================
// NOTIFICAÇÕES (ESQUELETO)
// =========================

async function loadNotificacoes() {
  const panel = document.getElementById("notif-panel");
  const badge = document.getElementById("notif-badge");

  // Ainda não há nó de notificações; placeholder simples
  const pendentes = []; // futura leitura em /notificacoes/{userId}

  if (!pendentes.length) {
    badge.classList.add("hidden");
    panel.innerHTML =
      "<div style='font-size:12px;color:#6b7280;'>Sem notificações pendentes.</div>";
  } else {
    badge.textContent = pendentes.length;
    badge.classList.remove("hidden");
    panel.innerHTML = pendentes
      .map(
        (n) => `
        <div class="notif-item">
          <strong>${n.titulo}</strong><br>
          <span>${n.mensagem}</span>
        </div>
      `
      )
      .join("");
  }
}

// =========================
// INÍCIO
// =========================

window.addEventListener("load", initApp);
