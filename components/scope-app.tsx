"use client";

import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Bot,
  BarChart3,
  Bell,
  Briefcase,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  Clock3,
  Command,
  Code2,
  ExternalLink,
  FileText,
  Flag,
  Folder,
  Globe2,
  Grid2X2,
  GitBranch,
  Hash,
  Inbox,
  LayoutList,
  Link2,
  Menu,
  MessageCircle,
  Mic2,
  Megaphone,
  MoreHorizontal,
  Palette,
  PanelLeftClose,
  Paperclip,
  Plus,
  Search,
  Settings,
  Sparkles,
  Rocket,
  Repeat2,
  Server,
  SlidersHorizontal,
  SunMoon,
  Target,
  UserRound,
  Users,
  Upload,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { statusLabels } from "@/lib/demo-data";
import { translate } from "@/lib/i18n";
import type {
  Appearance,
  AutonomyLevel,
  Milestone,
  OnboardingState,
  Priority,
  SavedView,
  Task,
  TaskDependency,
  TaskStatus,
  ViewMode,
} from "@/lib/types";
import { ScopeMark } from "./scope-mark";

const statusOrder: TaskStatus[] = ["backlog", "in-progress", "review", "done"];
const priorityLabels: Record<Priority, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  urgent: "Dringend",
};
type BackendProject = {
  id: string;
  name: string;
  key: string;
  description: string;
  color: string;
  icon?: string;
  logoDataUrl?: string | null;
};
type AccountState = {
  id: string;
  name: string;
  email: string;
  role: string;
  workspaceName: string;
  locale: "de" | "en";
};

export function ScopeApp() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboarding, setOnboarding] = useState<OnboardingState>({
    mode: "solo",
    name: "",
    email: "",
    password: "",
    workspace: "Mein Workspace",
    provider: "none",
    providerApiKey: "",
    providerEndpoint: "",
    template: "software",
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<BackendProject[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [account, setAccount] = useState<AccountState>({
    id: "",
    name: "",
    email: "",
    role: "member",
    workspaceName: "",
    locale: "de",
  });
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const currentProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  const currentTasks = useMemo(
    () =>
      currentProject
        ? tasks.filter((task) => task.projectId === currentProject.id)
        : tasks,
    [currentProject, tasks],
  );
  const canAdmin = account.role === "owner" || account.role === "admin";
  const [authenticated, setAuthenticated] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [backendError, setBackendError] = useState("");
  const [view, setView] = useState<ViewMode>("board");
  const [nav, setNav] = useState("project");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [appearance, setAppearance] = useState<Appearance>("dark");
  const [accent, setAccent] = useState("#8CA8FF");
  const [density, setDensity] = useState("comfortable");
  const [autonomy, setAutonomy] = useState<AutonomyLevel>("suggest");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const storedAppearance =
      (window.localStorage.getItem("scope-appearance") as Appearance | null) ??
      "dark";
    setAppearance(storedAppearance);
    if (window.matchMedia("(max-width: 920px)").matches) setSidebarOpen(false);
    void loadBootstrap();
  }, []);

  const loadBootstrap = async () => {
    try {
      const response = await fetch("/api/v1/bootstrap", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error?.message ?? "Backend nicht erreichbar");
      const data = payload.data;
      setOnboarded(Boolean(data.setupComplete));
      setAuthenticated(Boolean(data.authenticated));
      setLoginRequired(Boolean(data.setupComplete && !data.authenticated));
      if (data.authenticated) {
        setWorkspaceId(data.currentWorkspace?.id ?? "");
        setAccount({
          id: data.user?.id ?? "",
          name: data.user?.name ?? "",
          email: data.user?.email ?? "",
          role: data.currentWorkspace?.role ?? "member",
          workspaceName: data.currentWorkspace?.name ?? "",
          locale: data.user?.locale === "en" ? "en" : "de",
        });
        document.documentElement.lang =
          data.user?.locale === "en" ? "en" : "de";
        setProjects(data.projects ?? []);
        setSelectedProjectId(
          (current) => current || data.projects?.[0]?.id || "",
        );
        setTasks(data.tasks ?? []);
        setUnreadNotifications(data.unreadNotifications ?? 0);
        if (data.user?.appearance && data.user.appearance !== "system")
          setAppearance(data.user.appearance);
        if (data.user?.preferredAutonomy)
          setAutonomy(data.user.preferredAutonomy);
      }
      setBackendError("");
    } catch (error) {
      setBackendError(
        error instanceof Error ? error.message : "Backend nicht erreichbar",
      );
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    if (!authenticated || !workspaceId) return;
    const events = new EventSource(`/api/v1/events?workspaceId=${workspaceId}`);
    events.addEventListener("activity", () => void loadBootstrap());
    return () => events.close();
  }, [authenticated, workspaceId]);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.dataset.theme = appearance;
    root.style.setProperty("--accent", accent);
    root.dataset.density = density;
    window.localStorage.setItem("scope-appearance", appearance);
    if (authenticated)
      void fetch("/api/v1/users/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appearance,
          themePreferences: { accent, density },
        }),
      });
  }, [appearance, accent, density, ready, authenticated]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setNewTaskOpen(false);
        setSelectedTask(null);
        setSettingsOpen(false);
      }
      if (
        key === "c" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !isTyping(event.target)
      )
        setNewTaskOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const finishOnboarding = async () => {
    const setupToken =
      new URLSearchParams(window.location.search).get("setup") ?? undefined;
    const provider =
      onboarding.provider === "none"
        ? undefined
        : {
            type: onboarding.provider,
            name:
              onboarding.provider[0].toUpperCase() +
              onboarding.provider.slice(1),
            endpoint: onboarding.providerEndpoint || undefined,
            apiKey: onboarding.providerApiKey || undefined,
          };
    const response = await fetch("/api/v1/setup/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        setupToken,
        name: onboarding.name,
        email: onboarding.email,
        password: onboarding.password,
        mode: onboarding.mode,
        workspace: onboarding.workspace,
        locale: navigator.language.startsWith("de") ? "de" : "en",
        template: onboarding.template,
        provider,
      }),
    });
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.error?.message ?? "Setup fehlgeschlagen");
    if (onboarding.mode === "team") {
      const inviteResponse = await fetch("/api/v1/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: payload.data.workspaceId,
          role: "member",
          expiresInDays: 7,
        }),
      });
      const invitePayload = await inviteResponse.json();
      if (inviteResponse.ok) setShareUrl(invitePayload.data.url);
    }
    window.history.replaceState({}, "", window.location.pathname);
    await loadBootstrap();
  };

  const addTask = async (
    title: string,
    description: string,
    dueDate: string,
    priority: Priority,
  ) => {
    const projectId = currentProject?.id;
    if (!projectId) return notify("Kein Projekt vorhanden");
    const response = await fetch("/api/v1/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        projectId,
        title,
        description,
        dueDate: dueDate || null,
        priority,
      }),
    });
    const payload = await response.json();
    if (!response.ok)
      return notify(
        payload.error?.message ?? "Aufgabe konnte nicht erstellt werden",
      );
    const task: Task = {
      ...payload.data,
      dueDate: payload.data.dueDate?.slice?.(0, 10) ?? dueDate,
      assignee: "–",
      labels: [],
      subtasks: [],
      comments: 0,
    };
    setTasks((current) => [task, ...current]);
    setNewTaskOpen(false);
    notify("Aufgabe erstellt");
  };

  const createInvitation = async () => {
    if (!workspaceId) return;
    const response = await fetch("/api/v1/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, role: "member", expiresInDays: 7 }),
    });
    const payload = await response.json();
    if (!response.ok)
      return notify(
        payload.error?.message ?? "Einladung konnte nicht erstellt werden",
      );
    setShareUrl(payload.data.url);
  };

  const createProject = async (
    name: string,
    description: string,
    key: string,
    color: string,
    icon: string,
    logoDataUrl: string | null,
  ) => {
    const response = await fetch("/api/v1/projects", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        workspaceId,
        name,
        description,
        key,
        color,
        icon,
        logoDataUrl,
      }),
    });
    const payload = await response.json();
    if (!response.ok)
      throw new Error(
        payload.error?.message ?? "Projekt konnte nicht erstellt werden",
      );
    setSelectedProjectId(payload.data.id);
    setProjectDialogOpen(false);
    await loadBootstrap();
    setNav("project");
    notify("Projekt erstellt");
  };

  const addComment = async (taskId: string, body: string) => {
    const response = await fetch(`/api/v1/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const payload = await response.json();
    if (!response.ok)
      throw new Error(
        payload.error?.message ?? "Kommentar konnte nicht gespeichert werden",
      );
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, comments: task.comments + 1 } : task,
      ),
    );
    setSelectedTask((task) =>
      task?.id === taskId ? { ...task, comments: task.comments + 1 } : task,
    );
    notify("Kommentar gespeichert");
  };

  const deleteTask = async (task: Task) => {
    const response = await fetch(`/api/v1/tasks/${task.id}`, {
      method: "DELETE",
    });
    const payload = await response.json();
    if (!response.ok)
      return notify(
        payload.error?.message ?? "Aufgabe konnte nicht gelöscht werden",
      );
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setSelectedTask(null);
    notify("Aufgabe gelöscht");
  };

  const logout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    setAuthenticated(false);
    setLoginRequired(true);
    setSettingsOpen(false);
    setWorkspaceId("");
    setProjects([]);
    setTasks([]);
  };

  const updateTask = async (
    id: string,
    patch: Partial<
      Pick<
        Task,
        | "status"
        | "priority"
        | "dueDate"
        | "title"
        | "description"
        | "assigneeId"
        | "milestoneId"
      >
    >,
  ) => {
    const before = tasks.find((task) => task.id === id);
    if (!before) return;
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    );
    setSelectedTask((current) =>
      current?.id === id ? { ...current, ...patch } : current,
    );
    const response = await fetch(`/api/v1/tasks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...patch,
        dueDate: patch.dueDate === "" ? null : patch.dueDate,
        version: before.version ?? 1,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setTasks((current) =>
        current.map((task) => (task.id === id ? before : task)),
      );
      setSelectedTask(before);
      return notify(payload.error?.message ?? "Änderung fehlgeschlagen");
    }
    const updated = {
      ...before,
      ...payload.data,
      dueDate: payload.data.dueDate?.slice?.(0, 10) ?? "",
    };
    setTasks((current) =>
      current.map((task) => (task.id === id ? updated : task)),
    );
    setSelectedTask((current) => (current?.id === id ? updated : current));
    notify(
      patch.status
        ? `Nach „${statusLabels[patch.status]}“ verschoben`
        : "Aufgabe aktualisiert",
    );
  };
  const updateStatus = (id: string, status: TaskStatus) =>
    updateTask(id, { status });

  if (!ready)
    return (
      <div className="boot-screen">
        <ScopeMark size={46} />
      </div>
    );
  if (backendError)
    return <BackendError message={backendError} onRetry={loadBootstrap} />;
  if (loginRequired && !authenticated)
    return (
      <LoginScreen
        onSuccess={loadBootstrap}
        appearance={appearance}
        setAppearance={setAppearance}
      />
    );
  if (!onboarded) {
    return (
      <Onboarding
        step={onboardingStep}
        state={onboarding}
        setState={setOnboarding}
        setStep={setOnboardingStep}
        onFinish={finishOnboarding}
        appearance={appearance}
        setAppearance={setAppearance}
      />
    );
  }

  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <Sidebar
        account={account}
        canAdmin={canAdmin}
        projects={projects}
        selectedProjectId={currentProject?.id ?? ""}
        onSelectProject={(id) => {
          setSelectedProjectId(id);
          setNav("project");
        }}
        nav={nav}
        setNav={setNav}
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        onSettings={() => setSettingsOpen(true)}
        onCommand={() => setCommandOpen(true)}
        onNewProject={() => setProjectDialogOpen(true)}
      />
      <main className="workspace">
        <Topbar
          nav={nav}
          projectName={currentProject?.name ?? "Projekt"}
          userName={account.name}
          locale={account.locale}
          sidebarOpen={sidebarOpen}
          onOpenSidebar={() => setSidebarOpen(true)}
          onCommand={() => setCommandOpen(true)}
          onProjects={() => setNav("projects")}
          onAssistant={() => setAssistantOpen(true)}
          onNotifications={() => setNotificationsOpen(true)}
          unread={unreadNotifications}
          onShare={canAdmin ? () => void createInvitation() : undefined}
        />
        {nav === "project" ? (
          <ProjectView
            project={currentProject}
            tasks={currentTasks}
            view={view}
            setView={setView}
            onNewTask={() => setNewTaskOpen(true)}
            onSelect={setSelectedTask}
            onUpdateStatus={updateStatus}
            onAssistant={() => setAssistantOpen(true)}
          />
        ) : nav === "dashboard" ? (
          <DashboardHub
            workspaceId={workspaceId}
            projectId={currentProject?.id ?? ""}
            projects={projects}
            tasks={tasks}
            onSelectTask={setSelectedTask}
            onChanged={loadBootstrap}
          />
        ) : nav === "meetings" ? (
          <MeetingsHub
            workspaceId={workspaceId}
            projects={projects}
            currentProjectId={currentProject?.id ?? ""}
          />
        ) : nav === "automations" ? (
          <AutomationsHub
            workspaceId={workspaceId}
            projectId={currentProject?.id ?? ""}
            canAdmin={canAdmin}
          />
        ) : nav === "admin" && canAdmin ? (
          <AdminHub workspaceId={workspaceId} />
        ) : nav === "my-work" ? (
          <MyWork
            tasks={tasks}
            onSelect={setSelectedTask}
            onNewTask={() => setNewTaskOpen(true)}
          />
        ) : nav === "calendar" ? (
          <CalendarView
            tasks={tasks}
            onSelect={setSelectedTask}
            onNewTask={() => setNewTaskOpen(true)}
            expanded
          />
        ) : nav === "inbox" ? (
          <TaskCollection
            title="Eingang"
            subtitle="Alle offenen Aufgaben im Workspace"
            tasks={tasks.filter((task) => task.status !== "done")}
            onSelect={setSelectedTask}
            onNewTask={() => setNewTaskOpen(true)}
          />
        ) : (
          <ProjectsOverviewV2
            projects={projects}
            tasks={tasks}
            onOpen={(id) => {
              setSelectedProjectId(id);
              setNav("project");
            }}
            onNew={canAdmin ? () => setProjectDialogOpen(true) : undefined}
          />
        )}
      </main>
      <MobileNav
        nav={nav}
        setNav={setNav}
        onMore={() => setSidebarOpen(true)}
      />
      {commandOpen && (
        <CommandPalette
          onClose={() => setCommandOpen(false)}
          onCreate={() => {
            setCommandOpen(false);
            setNewTaskOpen(true);
          }}
          onNavigate={(next) => {
            setNav(next);
            setCommandOpen(false);
          }}
          onAssistant={() => {
            setCommandOpen(false);
            setAssistantOpen(true);
          }}
        />
      )}
      {newTaskOpen && (
        <NewTaskDialog
          projectName={currentProject?.name ?? "Projekt"}
          onClose={() => setNewTaskOpen(false)}
          onAdd={addTask}
        />
      )}
      {selectedTask && (
        <TaskPanelV2
          task={selectedTask}
          workspaceId={workspaceId}
          account={account}
          onClose={() => setSelectedTask(null)}
          onUpdate={updateTask}
          onComment={addComment}
          onDelete={deleteTask}
          onChanged={loadBootstrap}
        />
      )}
      {projectDialogOpen && (
        <ProjectDialogV2
          onClose={() => setProjectDialogOpen(false)}
          onCreate={createProject}
        />
      )}
      {shareUrl && (
        <ShareDialog url={shareUrl} onClose={() => setShareUrl("")} />
      )}
      {assistantOpen && (
        <AssistantPanelV2
          workspaceId={workspaceId}
          projectId={currentProject?.id ?? ""}
          autonomy={autonomy}
          setAutonomy={setAutonomy}
          onClose={() => setAssistantOpen(false)}
          onChanged={loadBootstrap}
        />
      )}
      {notificationsOpen && (
        <NotificationCenter
          workspaceId={workspaceId}
          onClose={() => setNotificationsOpen(false)}
          onRead={() => setUnreadNotifications(0)}
        />
      )}
      {settingsOpen && (
        <SettingsDialogV2
          workspaceId={workspaceId}
          account={account}
          appearance={appearance}
          setAppearance={setAppearance}
          accent={accent}
          setAccent={setAccent}
          density={density}
          setDensity={setDensity}
          onClose={() => setSettingsOpen(false)}
          onSaved={loadBootstrap}
          onShare={() => void createInvitation()}
          onLogout={() => void logout()}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}

function BackendError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => Promise<void>;
}) {
  return (
    <main className="onboarding-shell">
      <header className="onboarding-header">
        <div className="brand">
          <ScopeMark size={30} />
          <span>Scope</span>
        </div>
      </header>
      <section className="onboarding-card">
        <div className="step-content">
          <div className="step-icon">
            <Archive size={22} />
          </div>
          <h1>Backend nicht erreichbar</h1>
          <p className="lead">{message}</p>
          <p className="subscription-note">
            Prüfe PostgreSQL und die DATABASE_URL. Mit Docker startet{" "}
            <code>./install.sh</code> die komplette Instanz.
          </p>
          <button className="primary-button" onClick={() => void onRetry()}>
            Erneut versuchen
          </button>
        </div>
      </section>
    </main>
  );
}

function LoginScreen({
  onSuccess,
  appearance,
  setAppearance,
}: {
  onSuccess: () => Promise<void>;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error?.message ?? "Anmeldung fehlgeschlagen");
      await onSuccess();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Anmeldung fehlgeschlagen",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="onboarding-shell">
      <header className="onboarding-header">
        <div className="brand">
          <ScopeMark size={30} />
          <span>Scope</span>
        </div>
        <button
          className="icon-button"
          onClick={() =>
            setAppearance(appearance === "dark" ? "light" : "dark")
          }
        >
          <SunMoon size={18} />
        </button>
      </header>
      <section className="onboarding-card">
        <form
          className="step-content"
          onSubmit={(event) => {
            event.preventDefault();
            void login();
          }}
        >
          <div className="step-icon">
            <UserRound size={22} />
          </div>
          <h1>Willkommen zurück.</h1>
          <p className="lead">Melde dich mit deinem lokalen Scope-Konto an.</p>
          <div className="field-row">
            <label>
              E-Mail
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Passwort
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
          </div>
          {error && (
            <p className="subscription-note" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={loading}>
            {loading ? "Anmelden…" : "Anmelden"} <ArrowRight size={16} />
          </button>
        </form>
      </section>
    </main>
  );
}

function Onboarding({
  step,
  state,
  setState,
  setStep,
  onFinish,
  appearance,
  setAppearance,
}: {
  step: number;
  state: OnboardingState;
  setState: (state: OnboardingState) => void;
  setStep: (step: number) => void;
  onFinish: () => Promise<void>;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
}) {
  const steps = ["Willkommen", "Workspace", "KI", "Vorlage", "Bereit"];
  return (
    <main className="onboarding-shell">
      <header className="onboarding-header">
        <div className="brand">
          <ScopeMark size={30} />
          <span>Scope</span>
        </div>
        <button
          className="icon-button"
          aria-label="Darstellung wechseln"
          onClick={() =>
            setAppearance(appearance === "dark" ? "light" : "dark")
          }
        >
          <SunMoon size={18} />
        </button>
      </header>
      <div
        className="onboarding-progress"
        aria-label={`Schritt ${step + 1} von ${steps.length}`}
      >
        {steps.map((label, index) => (
          <div key={label} className={index <= step ? "active" : ""}>
            <span>{index < step ? <Check size={12} /> : index + 1}</span>
            <small>{label}</small>
          </div>
        ))}
      </div>
      <section className="onboarding-card">
        {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}
        {step === 1 && (
          <WorkspaceStep
            state={state}
            setState={setState}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <AiStep state={state} setState={setState} onNext={() => setStep(3)} />
        )}
        {step === 3 && (
          <TemplateStep
            state={state}
            setState={setState}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && <FinishStep state={state} onFinish={onFinish} />}
        {step > 0 && (
          <button className="back-link" onClick={() => setStep(step - 1)}>
            <ArrowLeft size={15} /> Zurück
          </button>
        )}
      </section>
      <footer className="onboarding-footer">
        <span>Deine Daten bleiben auf deinem Server.</span>
        <span>AGPLv3 · Open Source</span>
      </footer>
    </main>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="welcome-step">
      <div className="fold-hero">
        <ScopeMark size={112} />
      </div>
      <p className="step-kicker">Willkommen bei Scope</p>
      <h1>
        Aus Vorhaben wird
        <br />
        Fortschritt.
      </h1>
      <p className="lead">
        Ein ruhiger Ort für Projekte, Aufgaben und die Arbeit dazwischen. Selbst
        gehostet. KI nur, wenn du sie willst.
      </p>
      <button className="primary-button large" onClick={onNext}>
        Scope einrichten <ArrowRight size={17} />
      </button>
    </div>
  );
}

function WorkspaceStep({
  state,
  setState,
  onNext,
}: {
  state: OnboardingState;
  setState: (state: OnboardingState) => void;
  onNext: () => void;
}) {
  return (
    <div className="step-content">
      <div className="step-icon">
        <Users size={22} />
      </div>
      <h1>Wie arbeitest du?</h1>
      <p className="lead">
        Scope passt Rollen und Einladungen an deinen Workspace an.
      </p>
      <div className="choice-grid two">
        <Choice
          active={state.mode === "solo"}
          icon={<UserRound />}
          title="Nur für mich"
          text="Ein persönlicher Workspace ohne Teamverwaltung."
          onClick={() =>
            setState({ ...state, mode: "solo", workspace: "Mein Workspace" })
          }
        />
        <Choice
          active={state.mode === "team"}
          icon={<Users />}
          title="Mit einem Team"
          text="Gemeinsame Projekte, Rollen und Einladungen."
          onClick={() =>
            setState({ ...state, mode: "team", workspace: "Scope Studio" })
          }
        />
      </div>
      <div className="field-row">
        <label>
          Dein Name
          <input
            autoComplete="name"
            value={state.name}
            onChange={(event) =>
              setState({ ...state, name: event.target.value })
            }
          />
        </label>
        <label>
          Workspace
          <input
            value={state.workspace}
            onChange={(event) =>
              setState({ ...state, workspace: event.target.value })
            }
          />
        </label>
      </div>
      <div className="field-row">
        <label>
          E-Mail
          <input
            type="email"
            autoComplete="email"
            value={state.email}
            onChange={(event) =>
              setState({ ...state, email: event.target.value })
            }
          />
        </label>
        <label>
          Passwort · mindestens 10 Zeichen
          <input
            type="password"
            autoComplete="new-password"
            value={state.password}
            onChange={(event) =>
              setState({ ...state, password: event.target.value })
            }
          />
        </label>
      </div>
      <button
        className="primary-button"
        disabled={
          !state.name.trim() ||
          !state.workspace.trim() ||
          !state.email.includes("@") ||
          state.password.length < 10
        }
        onClick={onNext}
      >
        Weiter <ArrowRight size={16} />
      </button>
    </div>
  );
}

function AiStep({
  state,
  setState,
  onNext,
}: {
  state: OnboardingState;
  setState: (state: OnboardingState) => void;
  onNext: () => void;
}) {
  const [connected, setConnected] = useState(false);
  const providers = [
    { id: "openai", name: "OpenAI", hint: "API-Schlüssel" },
    { id: "anthropic", name: "Anthropic", hint: "API-Schlüssel" },
    { id: "gemini", name: "Gemini", hint: "Free Tier möglich" },
    { id: "openrouter", name: "OpenRouter", hint: "Viele Modelle" },
    { id: "ollama", name: "Ollama", hint: "Lokal · Kostenlos" },
    { id: "compatible", name: "Kompatibel", hint: "Eigener Endpoint" },
  ];
  return (
    <div className="step-content">
      <div className="step-icon">
        <Sparkles size={22} />
      </div>
      <h1>KI, die zu dir passt.</h1>
      <p className="lead">
        Wähle einen Provider oder richte ihn später ein. Scope funktioniert
        immer auch ohne KI.
      </p>
      <div className="provider-grid">
        {providers.map((provider) => (
          <button
            key={provider.id}
            className={
              state.provider === provider.id ? "provider active" : "provider"
            }
            onClick={() => {
              setState({ ...state, provider: provider.id });
              setConnected(false);
            }}
          >
            <span className="provider-mark">{provider.name.slice(0, 1)}</span>
            <span>
              <strong>{provider.name}</strong>
              <small>{provider.hint}</small>
            </span>
            {state.provider === provider.id && <CheckCircle2 size={17} />}
          </button>
        ))}
      </div>
      {state.provider !== "none" && (
        <div className="provider-config">
          <label>
            {state.provider === "ollama" || state.provider === "compatible"
              ? "Endpoint"
              : "API-Schlüssel"}
            <input
              type={
                state.provider === "ollama" || state.provider === "compatible"
                  ? "url"
                  : "password"
              }
              placeholder={
                state.provider === "ollama"
                  ? "http://host.docker.internal:11434/v1"
                  : state.provider === "compatible"
                    ? "https://server.example/v1"
                    : "••••••••••••••••"
              }
              value={
                state.provider === "ollama" || state.provider === "compatible"
                  ? state.providerEndpoint
                  : state.providerApiKey
              }
              onChange={(event) => {
                setState({
                  ...state,
                  ...(state.provider === "ollama" ||
                  state.provider === "compatible"
                    ? { providerEndpoint: event.target.value }
                    : { providerApiKey: event.target.value }),
                });
                setConnected(false);
              }}
            />
          </label>
          <button
            className="secondary-button compact"
            onClick={() => setConnected(true)}
          >
            {connected ? (
              <>
                <Check size={15} /> Für Setup vorgemerkt
              </>
            ) : (
              "Eingabe übernehmen"
            )}
          </button>
        </div>
      )}
      <div className="privacy-note">
        <Target size={18} />
        <span>
          <strong>Du behältst die Kontrolle.</strong> Schlüssel werden
          verschlüsselt. Vor jeder KI-Änderung siehst du eine Vorschau.
        </span>
      </div>
      <div className="button-row">
        <button
          className="secondary-button"
          onClick={() => {
            setState({ ...state, provider: "none" });
            onNext();
          }}
        >
          Ohne KI fortfahren
        </button>
        <button className="primary-button" onClick={onNext}>
          {state.provider === "none"
            ? "Später einrichten"
            : "Provider auswählen"}{" "}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function TemplateStep({
  state,
  setState,
  onNext,
}: {
  state: OnboardingState;
  setState: (state: OnboardingState) => void;
  onNext: () => void;
}) {
  const templates = [
    {
      id: "blank",
      icon: <FileText />,
      title: "Leeres Projekt",
      text: "Ein klarer Anfang.",
    },
    {
      id: "software",
      icon: <Command />,
      title: "Softwareentwicklung",
      text: "Backlog, Umsetzung und Review.",
    },
    {
      id: "marketing",
      icon: <Target />,
      title: "Marketing",
      text: "Ideen, Produktion und Veröffentlichung.",
    },
    {
      id: "personal",
      icon: <UserRound />,
      title: "Persönlich",
      text: "Vorhaben und nächste Schritte.",
    },
  ];
  return (
    <div className="step-content">
      <div className="step-icon">
        <Grid2X2 size={22} />
      </div>
      <h1>Womit möchtest du starten?</h1>
      <p className="lead">
        Die Vorlage legt nur den Anfang fest. Alles bleibt veränderbar.
      </p>
      <div className="choice-grid two template-grid">
        {templates.map((template) => (
          <Choice
            key={template.id}
            active={state.template === template.id}
            icon={template.icon}
            title={template.title}
            text={template.text}
            onClick={() => setState({ ...state, template: template.id })}
          />
        ))}
      </div>
      <button className="primary-button" onClick={onNext}>
        Workspace vorbereiten <ArrowRight size={16} />
      </button>
    </div>
  );
}

function FinishStep({
  state,
  onFinish,
}: {
  state: OnboardingState;
  onFinish: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="finish-step">
      <div className="success-ring">
        <Check size={31} />
      </div>
      <h1>{state.workspace} ist bereit.</h1>
      <p className="lead">
        Dein erstes Projekt wartet. Wir zeigen dir die wichtigsten Stellen
        direkt bei der Arbeit.
      </p>
      {state.mode === "team" && (
        <div className="privacy-note">
          <Link2 size={18} />
          <span>
            <strong>Echter Einladungslink.</strong> Beim Erstellen erzeugt Scope
            einen einmal verwendbaren, sieben Tage gültigen Link.
          </span>
        </div>
      )}
      <div className="setup-summary">
        <span>
          <CheckCircle2 />{" "}
          {state.mode === "team" ? "Team-Workspace" : "Persönlicher Workspace"}
        </span>
        <span>
          <CheckCircle2 />{" "}
          {state.provider === "none"
            ? "KI später einrichten"
            : `${state.provider} gewählt`}
        </span>
        <span>
          <CheckCircle2 /> Projektvorlage vorbereitet
        </span>
      </div>
      {error && (
        <p className="subscription-note" role="alert">
          {error}
        </p>
      )}
      <button
        className="primary-button large"
        disabled={loading}
        onClick={() => {
          setLoading(true);
          setError("");
          void onFinish().catch((reason) => {
            setError(
              reason instanceof Error ? reason.message : "Setup fehlgeschlagen",
            );
            setLoading(false);
          });
        }}
      >
        {loading ? "Workspace wird angelegt…" : "Workspace öffnen"}{" "}
        <ArrowRight size={17} />
      </button>
    </div>
  );
}

function Choice({
  active,
  icon,
  title,
  text,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "choice active" : "choice"} onClick={onClick}>
      <span className="choice-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <span className="radio">{active && <span />}</span>
    </button>
  );
}

function Sidebar({
  account,
  canAdmin,
  projects,
  selectedProjectId,
  onSelectProject,
  nav,
  setNav,
  open,
  setOpen,
  onSettings,
  onCommand,
  onNewProject,
}: {
  account: AccountState;
  canAdmin: boolean;
  projects: BackendProject[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  nav: string;
  setNav: (nav: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSettings: () => void;
  onCommand: () => void;
  onNewProject: () => void;
}) {
  const primary = [
    { id: "dashboard", label: "Dashboard", icon: <BarChart3 /> },
    {
      id: "my-work",
      label: translate(account.locale, "myWork"),
      icon: <CircleDot />,
    },
    { id: "inbox", label: translate(account.locale, "inbox"), icon: <Inbox /> },
    {
      id: "calendar",
      label: translate(account.locale, "calendar"),
      icon: <CalendarDays />,
    },
    { id: "meetings", label: "Meetings", icon: <Mic2 /> },
    { id: "automations", label: "Automationen", icon: <Workflow /> },
  ];
  const initials =
    account.name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-head">
        <div className="brand">
          <ScopeMark size={25} />
          <span>Scope</span>
        </div>
        <button
          className="icon-button compact"
          onClick={() => setOpen(false)}
          aria-label="Sidebar schließen"
        >
          <PanelLeftClose size={17} />
        </button>
      </div>
      <button className="command-trigger" onClick={onCommand}>
        <Search size={16} />
        <span>Suchen oder springen</span>
        <kbd>⌘ K</kbd>
      </button>
      <nav className="nav-section" aria-label="Hauptnavigation">
        {primary.map((item) => (
          <NavButton
            key={item.id}
            active={nav === item.id}
            onClick={() => {
              setNav(item.id);
              if (window.innerWidth < 768) setOpen(false);
            }}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </nav>
      <div className="sidebar-label">
        <span>{translate(account.locale, "projects")}</span>
        {canAdmin && (
          <button aria-label="Projekt hinzufügen" onClick={onNewProject}>
            <Plus size={14} />
          </button>
        )}
      </div>
      <nav className="nav-section project-links">
        {projects.map((project) => (
          <NavButton
            key={project.id}
            active={nav === "project" && selectedProjectId === project.id}
            onClick={() => {
              onSelectProject(project.id);
              if (window.innerWidth < 768) setOpen(false);
            }}
            icon={<ProjectGlyph project={project} size="small" />}
            label={project.name}
          />
        ))}
      </nav>
      <div className="sidebar-bottom">
        {canAdmin && (
          <button
            className={`nav-button ${nav === "admin" ? "active" : ""}`}
            onClick={() => setNav("admin")}
          >
            <Server size={18} />
            <span>Self-Hosting</span>
          </button>
        )}
        <button className="profile-button" onClick={onSettings}>
          <span className="avatar">{initials}</span>
          <span>
            <strong>{account.name}</strong>
            <small>{roleLabel(account.role)}</small>
          </span>
          <MoreHorizontal size={16} />
        </button>
        <button className="nav-button" onClick={onSettings}>
          <Settings size={18} />
          <span>{translate(account.locale, "settings")}</span>
        </button>
      </div>
    </aside>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      className={`nav-button ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {active && <span className="scope-fold" />}
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
      {count && <small className="nav-count">{count}</small>}
    </button>
  );
}

function Topbar({
  nav,
  projectName,
  userName,
  locale,
  sidebarOpen,
  onOpenSidebar,
  onCommand,
  onProjects,
  onAssistant,
  onNotifications,
  unread,
  onShare,
}: {
  nav: string;
  projectName: string;
  userName: string;
  locale: "de" | "en";
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  onCommand: () => void;
  onProjects: () => void;
  onAssistant: () => void;
  onNotifications: () => void;
  unread: number;
  onShare?: () => void;
}) {
  const sectionLabel =
    {
      dashboard: "Dashboard",
      "my-work": translate(locale, "myWork"),
      inbox: translate(locale, "inbox"),
      calendar: translate(locale, "calendar"),
      meetings: "Meetings",
      automations: "Automationen",
      admin: "Self-Hosting",
      projects: translate(locale, "projects"),
    }[nav] ?? translate(locale, "projects");
  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <header className="topbar">
      <div className="breadcrumbs">
        {!sidebarOpen && (
          <button
            className="icon-button compact desktop-only"
            onClick={onOpenSidebar}
          >
            <Menu size={17} />
          </button>
        )}
        {nav === "project" ? (
          <>
            <button
              type="button"
              className="breadcrumb-link"
              onClick={onProjects}
            >
              {translate(locale, "projects")}
            </button>
            <span className="breadcrumb-separator" aria-hidden="true">
              /
            </span>
            <strong>{projectName}</strong>
          </>
        ) : (
          <strong>{sectionLabel}</strong>
        )}
      </div>
      <div className="top-actions">
        <button
          className="icon-button mobile-search"
          onClick={onCommand}
          aria-label="Suchen"
        >
          <Search size={18} />
        </button>
        <button
          className="icon-button notification-button"
          onClick={onNotifications}
          aria-label={`Benachrichtigungen${unread ? `, ${unread} ungelesen` : ""}`}
        >
          <Bell size={18} />
          {unread > 0 && <i>{unread > 9 ? "9+" : unread}</i>}
        </button>
        <div className="avatar-stack">
          <span>{initials}</span>
        </div>
        {onShare && (
          <button className="secondary-button compact" onClick={onShare}>
            <Users size={15} /> {translate(locale, "share")}
          </button>
        )}
        <button className="assist-button" onClick={onAssistant}>
          <Sparkles size={16} /> <span>Scope Assist</span>
        </button>
      </div>
    </header>
  );
}

function ProjectView({
  project,
  tasks,
  view,
  setView,
  onNewTask,
  onSelect,
  onUpdateStatus,
  onAssistant,
}: {
  project?: BackendProject;
  tasks: Task[];
  view: ViewMode;
  setView: (view: ViewMode) => void;
  onNewTask: () => void;
  onSelect: (task: Task) => void;
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onAssistant: () => void;
}) {
  const done = tasks.filter((task) => task.status === "done").length;
  const urgent = tasks.filter(
    (task) =>
      task.priority === "urgent" &&
      task.status !== "done" &&
      isDue(task.dueDate),
  );
  return (
    <div className="content-area">
      <section className="project-header">
        <div>
          <div className="project-title-line">
            {project && <ProjectGlyph project={project} />}
            <h1>{project?.name ?? "Projekt"}</h1>
          </div>
          <p>
            {project?.description ||
              "Ein klarer Ort für die nächsten Schritte."}
          </p>
        </div>
        <div className="progress-block">
          <div>
            <span>Fortschritt</span>
            <strong>
              {tasks.length ? Math.round((done / tasks.length) * 100) : 0}%
            </strong>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </section>
      <div className="project-toolbar">
        <div className="view-switch" role="tablist" aria-label="Projektansicht">
          <button
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
          >
            <LayoutList size={16} /> Liste
          </button>
          <button
            className={view === "board" ? "active" : ""}
            onClick={() => setView("board")}
          >
            <Grid2X2 size={16} /> Board
          </button>
          <button
            className={view === "calendar" ? "active" : ""}
            onClick={() => setView("calendar")}
          >
            <CalendarDays size={16} /> Kalender
          </button>
        </div>
        <div className="toolbar-actions">
          <button className="primary-button compact" onClick={onNewTask}>
            <Plus size={16} /> Aufgabe
          </button>
        </div>
      </div>
      {urgent.length > 0 && (
        <div className="insight-strip">
          <div className="insight-fold">
            <Sparkles size={15} />
          </div>
          <p>
            <strong>
              {urgent.length} dringende{" "}
              {urgent.length === 1 ? "Aufgabe braucht" : "Aufgaben brauchen"}{" "}
              Aufmerksamkeit.
            </strong>{" "}
            Fällig heute oder bereits überfällig.
          </p>
          <button onClick={onAssistant}>
            Mit Assist prüfen <ArrowRight size={14} />
          </button>
        </div>
      )}
      {view === "board" && (
        <Board
          tasks={tasks}
          onSelect={onSelect}
          onStatus={onUpdateStatus}
          onNewTask={onNewTask}
        />
      )}
      {view === "list" && <TaskList tasks={tasks} onSelect={onSelect} />}
      {view === "calendar" && (
        <CalendarView tasks={tasks} onSelect={onSelect} />
      )}
    </div>
  );
}

function Board({
  tasks,
  onSelect,
  onStatus,
  onNewTask,
}: {
  tasks: Task[];
  onSelect: (task: Task) => void;
  onStatus: (id: string, status: TaskStatus) => void;
  onNewTask: () => void;
}) {
  return (
    <div className="board" aria-label="Kanban Board">
      {statusOrder.map((status) => {
        const items = tasks.filter((task) => task.status === status);
        return (
          <section className="board-column" key={status}>
            <header>
              <span className={`status-icon ${status}`} />{" "}
              <strong>{statusLabels[status]}</strong>
              <span>{items.length}</span>
              <button
                aria-label={`Aufgabe in ${statusLabels[status]} anlegen`}
                onClick={onNewTask}
              >
                <Plus size={15} />
              </button>
            </header>
            <div className="card-stack">
              {items.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => onSelect(task)}
                  onStatus={onStatus}
                />
              ))}
              <button className="add-inline" onClick={onNewTask}>
                <Plus size={15} /> Aufgabe hinzufügen
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TaskCard({
  task,
  onClick,
  onStatus,
}: {
  task: Task;
  onClick: () => void;
  onStatus: (id: string, status: TaskStatus) => void;
}) {
  const index = statusOrder.indexOf(task.status);
  return (
    <article
      className="task-card"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter") onClick();
      }}
    >
      <div className="task-card-top">
        <span
          className={`priority ${task.priority}`}
          title={priorityLabels[task.priority]}
        />
        <span className="task-key">{task.key}</span>
      </div>
      <h3>{task.title}</h3>
      {task.labels.length > 0 && (
        <div className="labels">
          {task.labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      )}
      <footer>
        <span className={isDue(task.dueDate) ? "due today" : "due"}>
          <CalendarDays size={13} />
          {formatDue(task.dueDate)}
        </span>
        <span className="task-card-meta">
          {task.comments > 0 && (
            <span>
              <MessageCircle size={13} />
              {task.comments}
            </span>
          )}
          <span className="avatar small">{task.assignee}</span>
        </span>
      </footer>
      <div className="keyboard-move">
        <button
          disabled={index === 0}
          aria-label="Eine Spalte zurück"
          onClick={(event) => {
            event.stopPropagation();
            onStatus(task.id, statusOrder[index - 1]);
          }}
        >
          <ArrowLeft size={13} />
        </button>
        <button
          disabled={index === statusOrder.length - 1}
          aria-label="Eine Spalte weiter"
          onClick={(event) => {
            event.stopPropagation();
            onStatus(task.id, statusOrder[index + 1]);
          }}
        >
          <ArrowRight size={13} />
        </button>
      </div>
    </article>
  );
}

function TaskList({
  tasks,
  onSelect,
}: {
  tasks: Task[];
  onSelect: (task: Task) => void;
}) {
  return (
    <div className="task-list">
      <div className="task-list-head">
        <span>Aufgabe</span>
        <span>Status</span>
        <span>Priorität</span>
        <span>Fällig</span>
        <span>Person</span>
      </div>
      {tasks.map((task) => (
        <button
          className="task-row"
          key={task.id}
          onClick={() => onSelect(task)}
        >
          <span className="task-title-cell">
            <Circle size={16} />
            <span>
              <strong>{task.title}</strong>
              <small>{task.key}</small>
            </span>
          </span>
          <span>
            <span className={`status-pill ${task.status}`}>
              {statusLabels[task.status]}
            </span>
          </span>
          <span>{priorityLabels[task.priority]}</span>
          <span>{formatDue(task.dueDate)}</span>
          <span className="avatar small">{task.assignee}</span>
        </button>
      ))}
    </div>
  );
}

function CalendarView({
  tasks,
  onSelect,
  onNewTask,
  expanded = false,
}: {
  tasks: Task[];
  onSelect: (task: Task) => void;
  onNewTask?: () => void;
  expanded?: boolean;
}) {
  const today = new Date();
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const blanks = (month.getDay() + 6) % 7;
  const dayCount = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const days = Array.from({ length: dayCount }, (_, index) => index + 1);
  const title = new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(month);
  const dateFor = (day: number) =>
    `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const moveMonth = (offset: number) =>
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  return (
    <div className={expanded ? "content-area calendar-page" : "calendar-wrap"}>
      {expanded && (
        <div className="standalone-title">
          <div>
            <p>Planung</p>
            <h1>{title}</h1>
          </div>
          {onNewTask && (
            <button className="primary-button compact" onClick={onNewTask}>
              <Plus size={16} /> Aufgabe
            </button>
          )}
        </div>
      )}
      <div className="calendar-head">
        <button
          aria-label="Vorheriger Monat"
          className="icon-button compact"
          onClick={() => moveMonth(-1)}
        >
          <ArrowLeft size={15} />
        </button>
        <strong>{title}</strong>
        <button
          aria-label="Nächster Monat"
          className="icon-button compact"
          onClick={() => moveMonth(1)}
        >
          <ArrowRight size={15} />
        </button>
        <button
          className="secondary-button compact"
          onClick={() =>
            setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
          }
        >
          Heute
        </button>
      </div>
      <div className="calendar-grid">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
          <div className="weekday" key={day}>
            {day}
          </div>
        ))}
        {Array.from({ length: blanks }, (_, index) => (
          <div className="day muted" key={`blank-${index}`} />
        ))}
        {days.map((day) => {
          const date = dateFor(day);
          const dateTasks = tasks.filter((task) => task.dueDate === date);
          return (
            <div
              className={`day ${date === localDate() ? "current" : ""}`}
              key={day}
            >
              <span>{day}</span>
              {dateTasks.map((task) => (
                <button key={task.id} onClick={() => onSelect(task)}>
                  <i className={`priority ${task.priority}`} />
                  {task.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MyWork({
  tasks,
  onSelect,
  onNewTask,
}: {
  tasks: Task[];
  onSelect: (task: Task) => void;
  onNewTask: () => void;
}) {
  const today = localDate();
  const due = tasks.filter(
    (task) =>
      Boolean(task.dueDate) && task.dueDate <= today && task.status !== "done",
  );
  const dateLabel = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return (
    <div className="content-area my-work">
      <div className="standalone-title">
        <div>
          <p>{dateLabel}</p>
          <h1>Meine Arbeit</h1>
        </div>
        <button className="primary-button compact" onClick={onNewTask}>
          <Plus size={16} /> Aufgabe
        </button>
      </div>
      <section className="focus-summary">
        <div className="focus-mark">
          <Target />
        </div>
        <div>
          <strong>Dein Fokus für heute</strong>
          <p>{due.length} Aufgaben brauchen heute deine Aufmerksamkeit.</p>
        </div>
        <span>{due.length}</span>
      </section>
      <h2>Heute & überfällig</h2>
      <TaskList tasks={due} onSelect={onSelect} />
      <h2>Demnächst</h2>
      <TaskList
        tasks={tasks.filter(
          (task) => task.dueDate > today && task.status !== "done",
        )}
        onSelect={onSelect}
      />
    </div>
  );
}

function TaskCollection({
  title,
  subtitle,
  tasks,
  onSelect,
  onNewTask,
}: {
  title: string;
  subtitle: string;
  tasks: Task[];
  onSelect: (task: Task) => void;
  onNewTask: () => void;
}) {
  return (
    <div className="content-area my-work">
      <div className="standalone-title">
        <div>
          <p>{subtitle}</p>
          <h1>{title}</h1>
        </div>
        <button className="primary-button compact" onClick={onNewTask}>
          <Plus size={16} /> Aufgabe
        </button>
      </div>
      <TaskList tasks={tasks} onSelect={onSelect} />
    </div>
  );
}

function ProjectsOverview({
  projects,
  tasks,
  onOpen,
  onNew,
}: {
  projects: BackendProject[];
  tasks: Task[];
  onOpen: (id: string) => void;
  onNew?: () => void;
}) {
  return (
    <div className="content-area projects-page">
      <div className="standalone-title">
        <div>
          <p>Workspace</p>
          <h1>Projekte</h1>
        </div>
        {onNew && (
          <button className="primary-button compact" onClick={onNew}>
            <Plus size={16} /> Projekt
          </button>
        )}
      </div>
      <div className="project-list">
        {projects.map((project) => {
          const projectTasks = tasks.filter(
            (task) => task.projectId === project.id,
          );
          const progress = projectTasks.length
            ? Math.round(
                (projectTasks.filter((task) => task.status === "done").length /
                  projectTasks.length) *
                  100,
              )
            : 0;
          return (
            <button key={project.id} onClick={() => onOpen(project.id)}>
              <span
                className="large-project-glyph"
                style={{ background: project.color }}
              >
                {project.name.slice(0, 1)}
              </span>
              <span className="project-copy">
                <strong>{project.name}</strong>
                <small>{project.description}</small>
              </span>
              <span className="member-mini" />
              <span className="project-progress">
                <i>
                  <b style={{ width: `${progress}%` }} />
                </i>
                <small>{progress}%</small>
              </span>
              <ArrowRight size={17} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProjectsOverviewV2({
  projects,
  tasks,
  onOpen,
  onNew,
}: {
  projects: BackendProject[];
  tasks: Task[];
  onOpen: (id: string) => void;
  onNew?: () => void;
}) {
  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const dueTasks = tasks.filter(
    (task) => task.status !== "done" && isDue(task.dueDate),
  ).length;
  return (
    <div className="content-area projects-page">
      <div className="standalone-title">
        <div>
          <p>Workspace</p>
          <h1>Projekte</h1>
        </div>
        {onNew && (
          <button className="primary-button compact" onClick={onNew}>
            <Plus size={16} /> Projekt
          </button>
        )}
      </div>
      <div className="overview-metrics">
        <article>
          <Folder />
          <span>
            <strong>{projects.length}</strong>
            <small>Projekte</small>
          </span>
        </article>
        <article>
          <CircleDot />
          <span>
            <strong>{openTasks}</strong>
            <small>Offene Aufgaben</small>
          </span>
        </article>
        <article>
          <Clock3 />
          <span>
            <strong>{dueTasks}</strong>
            <small>Fällig oder überfällig</small>
          </span>
        </article>
      </div>
      <div className="project-list">
        {projects.map((project) => {
          const projectTasks = tasks.filter(
            (task) => task.projectId === project.id,
          );
          const progress = projectTasks.length
            ? Math.round(
                (projectTasks.filter((task) => task.status === "done").length /
                  projectTasks.length) *
                  100,
              )
            : 0;
          return (
            <button key={project.id} onClick={() => onOpen(project.id)}>
              <ProjectGlyph project={project} size="large" />
              <span className="project-copy">
                <strong>{project.name}</strong>
                <small>
                  {project.description || `${projectTasks.length} Aufgaben`}
                </small>
              </span>
              <span className="member-mini" />
              <span className="project-progress">
                <i>
                  <b style={{ width: `${progress}%` }} />
                </i>
                <small>{progress}%</small>
              </span>
              <ArrowRight size={17} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

type DashboardData = {
  summary: {
    projects: number;
    tasks: number;
    open: number;
    done: number;
    overdue: number;
    upcoming: number;
    blocked: number;
    unassigned: number;
    progress: number;
  };
  milestones: Array<
    Milestone & { totalTasks: number; completedTasks: number; progress: number }
  >;
  workload: Array<{
    id: string;
    name: string;
    role: string;
    openTasks: number;
    urgentTasks: number;
  }>;
  healthIssues: Array<{
    type: string;
    severity: string;
    count: number;
    title: string;
  }>;
};

function DashboardHub({
  workspaceId,
  projectId,
  projects,
  tasks,
  onSelectTask,
  onChanged,
}: {
  workspaceId: string;
  projectId: string;
  projects: BackendProject[];
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onChanged: () => Promise<void>;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [viewName, setViewName] = useState("");
  const [viewStatus, setViewStatus] = useState<TaskStatus | "all">("all");
  const [activeView, setActiveView] = useState<SavedView | null>(null);
  const [error, setError] = useState("");
  const load = async () => {
    const [dashboardResponse, milestoneResponse, viewResponse] =
      await Promise.all([
        fetch(`/api/v1/dashboard?workspaceId=${workspaceId}`, {
          cache: "no-store",
        }),
        projectId
          ? fetch(`/api/v1/milestones?projectId=${projectId}`, {
              cache: "no-store",
            })
          : Promise.resolve(null),
        fetch(`/api/v1/saved-views?workspaceId=${workspaceId}`, {
          cache: "no-store",
        }),
      ]);
    const dashboardPayload = await dashboardResponse.json();
    if (dashboardResponse.ok) setData(dashboardPayload.data);
    if (milestoneResponse) {
      const payload = await milestoneResponse.json();
      if (milestoneResponse.ok)
        setMilestones(
          payload.data.map((item: Milestone & { targetDate?: string }) => ({
            ...item,
            targetDate: item.targetDate?.slice?.(0, 10) ?? "",
          })),
        );
    }
    const viewPayload = await viewResponse.json();
    if (viewResponse.ok) setViews(viewPayload.data);
  };
  useEffect(() => {
    void load();
  }, [workspaceId, projectId]);
  const createMilestone = async () => {
    if (!name.trim() || !projectId) return;
    const response = await fetch("/api/v1/milestones", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        projectId,
        name: name.trim(),
        targetDate: targetDate || null,
        status: "active",
      }),
    });
    const payload = await response.json();
    if (!response.ok)
      return setError(
        payload.error?.message ?? "Meilenstein konnte nicht erstellt werden",
      );
    setName("");
    setTargetDate("");
    await load();
    await onChanged();
  };
  const createView = async () => {
    if (!viewName.trim()) return;
    const conditions =
      viewStatus === "all"
        ? []
        : [{ field: "status", operator: "eq", value: viewStatus }];
    const response = await fetch("/api/v1/saved-views", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        projectId: projectId || null,
        name: viewName.trim(),
        scope: "personal",
        filters: { version: 1, conditions },
        layout: "list",
      }),
    });
    const payload = await response.json();
    if (!response.ok)
      return setError(
        payload.error?.message ?? "Ansicht konnte nicht gespeichert werden",
      );
    setViewName("");
    await load();
  };
  const filteredTasks = useMemo(() => {
    if (!activeView) return [];
    return tasks.filter((task) =>
      activeView.filters.conditions.every(
        (condition) =>
          condition.field !== "status" ||
          condition.operator !== "eq" ||
          task.status === condition.value,
      ),
    );
  }, [tasks, activeView]);
  return (
    <div className="content-area feature-hub">
      <section className="hub-title">
        <div>
          <span className="eyebrow">Workspace Intelligence</span>
          <h1>Dashboard</h1>
          <p>Fortschritt, Risiken und nächste Entscheidungen an einem Ort.</p>
        </div>
        <div className="health-score">
          <ScopeMark size={28} />
          <span>
            <strong>
              {Math.max(
                0,
                100 -
                  (data?.summary.overdue ?? 0) * 6 -
                  (data?.summary.blocked ?? 0) * 10,
              )}
            </strong>
            <small>Scope Health</small>
          </span>
        </div>
      </section>
      <div className="metric-grid">
        {[
          ["Fortschritt", `${data?.summary.progress ?? 0}%`],
          ["Offen", data?.summary.open ?? 0],
          ["Überfällig", data?.summary.overdue ?? 0],
          ["Blockiert", data?.summary.blocked ?? 0],
          ["Diese Woche", data?.summary.upcoming ?? 0],
          ["Ohne Person", data?.summary.unassigned ?? 0],
        ].map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="feature-card">
          <div className="section-heading">
            <div>
              <h2>
                <Flag size={17} /> Meilensteine
              </h2>
              <small>
                {projects.find((project) => project.id === projectId)?.name}
              </small>
            </div>
          </div>
          <div className="milestone-list">
            {milestones.length === 0 && (
              <p className="empty-copy">
                Noch keine Meilensteine. Lege das nächste klare Ziel fest.
              </p>
            )}
            {milestones.map((milestone) => {
              const related = tasks.filter(
                (task) => task.milestoneId === milestone.id,
              );
              const done = related.filter(
                (task) => task.status === "done",
              ).length;
              const progress = related.length
                ? Math.round((done / related.length) * 100)
                : 0;
              return (
                <article key={milestone.id}>
                  <i style={{ background: milestone.color }} />
                  <div>
                    <strong>{milestone.name}</strong>
                    <small>
                      {milestone.targetDate
                        ? new Intl.DateTimeFormat("de-DE", {
                            dateStyle: "medium",
                          }).format(
                            new Date(`${milestone.targetDate}T12:00:00`),
                          )
                        : "Kein Zieldatum"}{" "}
                      · {done}/{related.length} Aufgaben
                    </small>
                    <span>
                      <i style={{ width: `${progress}%` }} />
                    </span>
                  </div>
                  <em>{progress}%</em>
                </article>
              );
            })}
          </div>
          <div className="inline-create milestone-create">
            <input
              placeholder="Neuer Meilenstein"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
            <button
              className="primary-button compact"
              disabled={!name.trim()}
              onClick={() => void createMilestone()}
            >
              <Plus size={14} /> Anlegen
            </button>
          </div>
        </section>
        <section className="feature-card">
          <div className="section-heading">
            <div>
              <h2>
                <Sparkles size={17} /> Risiken
              </h2>
              <small>Regelbasiert und nachvollziehbar</small>
            </div>
          </div>
          <div className="health-list">
            {data?.healthIssues.length ? (
              data.healthIssues.map((issue) => (
                <article key={issue.type} className={issue.severity}>
                  <span>
                    <strong>{issue.title}</strong>
                    <small>
                      {issue.type === "blocked"
                        ? "Blockierende Aufgaben zuerst auflösen."
                        : issue.type === "overdue"
                          ? "Termine prüfen oder Arbeit neu planen."
                          : "Verantwortung sichtbar zuweisen."}
                    </small>
                  </span>
                  <b>{issue.count}</b>
                </article>
              ))
            ) : (
              <div className="healthy-state">
                <CheckCircle2 />
                <strong>Alles im grünen Bereich</strong>
                <small>Keine akuten Projektrisiken erkannt.</small>
              </div>
            )}
          </div>
          <div className="workload-list">
            {data?.workload.slice(0, 5).map((member) => (
              <div key={member.id}>
                <span className="avatar small">
                  {member.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <span>
                  <strong>{member.name}</strong>
                  <small>
                    {member.openTasks} offen · {member.urgentTasks} dringend
                  </small>
                </span>
                <i>
                  <b
                    style={{
                      width: `${Math.min(100, member.openTasks * 12)}%`,
                    }}
                  />
                </i>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="feature-card">
        <div className="section-heading">
          <div>
            <h2>
              <SlidersHorizontal size={17} /> Gespeicherte Ansichten
            </h2>
            <small>Persönliche Filter für wiederkehrende Arbeitsweisen</small>
          </div>
        </div>
        <div className="saved-view-row">
          {views.map((saved) => (
            <button
              key={saved.id}
              className={activeView?.id === saved.id ? "active" : ""}
              onClick={() =>
                setActiveView(activeView?.id === saved.id ? null : saved)
              }
            >
              <LayoutList size={15} />
              <span>
                <strong>{saved.name}</strong>
                <small>{saved.scope}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="inline-create">
          <input
            placeholder="Name der Ansicht"
            value={viewName}
            onChange={(event) => setViewName(event.target.value)}
          />
          <select
            value={viewStatus}
            onChange={(event) =>
              setViewStatus(event.target.value as TaskStatus | "all")
            }
          >
            <option value="all">Alle Status</option>
            {statusOrder.map((status) => (
              <option value={status} key={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
          <button
            className="secondary-button compact"
            disabled={!viewName.trim()}
            onClick={() => void createView()}
          >
            <Plus size={14} /> Speichern
          </button>
        </div>
        {activeView && (
          <div className="filtered-preview">
            <strong>
              {activeView.name} · {filteredTasks.length} Aufgaben
            </strong>
            {filteredTasks.slice(0, 6).map((task) => (
              <button key={task.id} onClick={() => onSelectTask(task)}>
                <span>{task.key}</span>
                {task.title}
                <i>{statusLabels[task.status]}</i>
              </button>
            ))}
          </div>
        )}
      </section>
      {error && (
        <p className="subscription-note" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
};
type NotificationPreferences = {
  channels: { inApp: boolean; email: boolean; push: boolean };
  digest: "instant" | "off";
  quietHours: {
    enabled?: boolean;
    start?: string;
    end?: string;
    timezone?: string;
  };
};

function vapidKeyBytes(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function NotificationCenter({
  workspaceId,
  onClose,
  onRead,
}: {
  workspaceId: string;
  onClose: () => void;
  onRead: () => void;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    channels: { inApp: true, email: false, push: false },
    digest: "instant",
    quietHours: {},
  });
  const [channelNotice, setChannelNotice] = useState("");
  const load = async () => {
    const [notificationResponse, preferencesResponse] = await Promise.all([
      fetch(`/api/v1/notifications?workspaceId=${workspaceId}`, {
        cache: "no-store",
      }),
      fetch(`/api/v1/notification-preferences?workspaceId=${workspaceId}`, {
        cache: "no-store",
      }),
    ]);
    const notificationPayload = await notificationResponse.json();
    const preferencesPayload = await preferencesResponse.json();
    if (notificationResponse.ok)
      setItems(notificationPayload.data.notifications);
    if (preferencesResponse.ok) setPreferences(preferencesPayload.data);
  };
  useEffect(() => {
    void load();
  }, [workspaceId]);
  const readAll = async () => {
    await fetch(`/api/v1/notifications?workspaceId=${workspaceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true, read: true }),
    });
    onRead();
    await load();
  };
  const savePreferences = async (next: NotificationPreferences) => {
    setChannelNotice("");
    if (next.channels.push && !preferences.channels.push) {
      const capabilityResponse = await fetch("/api/v1/push-subscriptions", {
        cache: "no-store",
      });
      const capability = await capabilityResponse.json();
      if (!capabilityResponse.ok || !capability.data.available) {
        setChannelNotice("Web Push wurde vom Owner noch nicht konfiguriert.");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setChannelNotice(
          "Dieser Browser unterstützt keine Push-Benachrichtigungen.",
        );
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setChannelNotice("Die Push-Berechtigung wurde nicht erteilt.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyBytes(capability.data.publicKey),
      });
      await fetch("/api/v1/push-subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
    }
    const response = await fetch("/api/v1/notification-preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, ...next }),
    });
    if (response.ok) {
      setPreferences(next);
      setChannelNotice("Einstellungen gespeichert.");
    } else setChannelNotice("Einstellungen konnten nicht gespeichert werden.");
  };
  return (
    <div
      className="panel-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="detail-panel notification-panel">
        <header>
          <span>
            <Bell size={16} /> Benachrichtigungen
          </span>
          <button
            className="icon-button compact"
            aria-label="Schließen"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="detail-content">
          <section
            className="notification-settings"
            aria-label="Benachrichtigungskanäle"
          >
            <strong>Kanäle</strong>
            <label>
              <span>In Scope (immer)</span>
              <input type="checkbox" checked disabled />
            </label>
            <label>
              <span>E-Mail</span>
              <input
                type="checkbox"
                checked={preferences.channels.email}
                onChange={(event) =>
                  void savePreferences({
                    ...preferences,
                    channels: {
                      ...preferences.channels,
                      email: event.target.checked,
                    },
                  })
                }
              />
            </label>
            <label>
              <span>Browser-Push</span>
              <input
                type="checkbox"
                checked={preferences.channels.push}
                onChange={(event) =>
                  void savePreferences({
                    ...preferences,
                    channels: {
                      ...preferences.channels,
                      push: event.target.checked,
                    },
                  })
                }
              />
            </label>
            <label>
              <span>Zustellung</span>
              <select
                value={preferences.digest}
                onChange={(event) =>
                  void savePreferences({
                    ...preferences,
                    digest: event.target
                      .value as NotificationPreferences["digest"],
                  })
                }
              >
                <option value="instant">Sofort</option>
                <option value="off">Pausieren</option>
              </select>
            </label>
            {channelNotice && <small>{channelNotice}</small>}
          </section>
          <button
            className="secondary-button compact"
            onClick={() => void readAll()}
          >
            Alle als gelesen markieren
          </button>
          <div className="notification-list">
            {items.length === 0 && (
              <div className="healthy-state">
                <Bell />
                <strong>Alles gelesen</strong>
                <small>
                  Neue Zuweisungen, Kommentare und Automationen erscheinen hier.
                </small>
              </div>
            )}
            {items.map((item) => (
              <article key={item.id} className={item.readAt ? "" : "unread"}>
                <i />
                <span>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <small>
                    {new Intl.DateTimeFormat("de-DE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.createdAt))}
                  </small>
                </span>
              </article>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

type MeetingRecord = {
  id: string;
  title: string;
  projectId?: string | null;
  source: "live" | "upload";
  status: string;
  transcript: string;
  summary?: {
    overview?: string;
    decisions?: Array<{ text: string }>;
    actionItems?: Array<{ title: string }>;
  };
  createdAt: string;
  recordingAttachmentId?: string | null;
};
function MeetingsHub({
  workspaceId,
  projects,
  currentProjectId,
}: {
  workspaceId: string;
  projects: BackendProject[];
  currentProjectId: string;
}) {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(currentProjectId);
  const [source, setSource] = useState<"live" | "upload">("live");
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<MeetingRecord | null>(null);
  const [transcript, setTranscript] = useState("");
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const activeMeeting = useRef<string>("");
  const load = async () => {
    const [meetingResponse, providerResponse] = await Promise.all([
      fetch(`/api/v1/meetings?workspaceId=${workspaceId}`, {
        cache: "no-store",
      }),
      fetch(`/api/v1/ai/providers?workspaceId=${workspaceId}`, {
        cache: "no-store",
      }),
    ]);
    const meetingPayload = await meetingResponse.json();
    const providerPayload = await providerResponse.json();
    if (meetingResponse.ok) setMeetings(meetingPayload.data);
    if (providerResponse.ok) {
      const available = (providerPayload.data as PublicProvider[]).filter(
        (item) => item.enabled && item.models.length,
      );
      setProviders(available);
      if (!providerId && available[0]) {
        setProviderId(available[0].id);
        setModel(available[0].models[0]);
      }
    }
  };
  useEffect(() => {
    void load();
  }, [workspaceId]);
  const upload = async (meetingId: string, media: File) => {
    const form = new FormData();
    form.set("workspaceId", workspaceId);
    form.set("projectId", projectId);
    form.set("entityType", "meeting");
    form.set("entityId", meetingId);
    form.set("file", media);
    const response = await fetch("/api/v1/attachments", {
      method: "POST",
      body: form,
    });
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.error?.message ?? "Upload fehlgeschlagen");
    await fetch(`/api/v1/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recordingAttachmentId: payload.data.id,
        status: "uploaded",
      }),
    });
    await load();
  };
  const create = async () => {
    setError("");
    if (!consent || !title.trim()) return;
    try {
      const response = await fetch("/api/v1/meetings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          projectId: projectId || null,
          title: title.trim(),
          source,
          language: "de",
          consentConfirmed: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error?.message ?? "Meeting konnte nicht erstellt werden",
        );
      const meeting = payload.data as MeetingRecord;
      activeMeeting.current = meeting.id;
      if (source === "upload") {
        if (!file)
          throw new Error("Bitte eine Audio- oder Videodatei auswählen.");
        await upload(meeting.id, file);
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        chunks.current = [];
        const nextRecorder = new MediaRecorder(stream);
        nextRecorder.ondataavailable = (event) => {
          if (event.data.size) chunks.current.push(event.data);
        };
        nextRecorder.onstop = () => {
          const blob = new Blob(chunks.current, {
            type: nextRecorder.mimeType || "audio/webm",
          });
          stream.getTracks().forEach((track) => track.stop());
          void upload(
            meeting.id,
            new File([blob], `${title.trim()}.webm`, { type: blob.type }),
          ).catch((reason) => setError(reason.message));
        };
        recorder.current = nextRecorder;
        nextRecorder.start(1000);
        setRecording(true);
      }
      setTitle("");
      setConsent(false);
      setFile(null);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Meeting konnte nicht erstellt werden",
      );
    }
  };
  const stop = () => {
    recorder.current?.stop();
    setRecording(false);
  };
  const openMeeting = (meeting: MeetingRecord) => {
    setSelected(meeting);
    setTranscript(meeting.transcript || "");
  };
  const saveTranscript = async () => {
    if (!selected) return;
    await fetch(`/api/v1/meetings/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    await load();
    setSelected((current) => (current ? { ...current, transcript } : current));
  };
  const transcribe = async (meeting: MeetingRecord) => {
    const response = await fetch(`/api/v1/meetings/${meeting.id}/transcribe`, {
      method: "POST",
    });
    const payload = await response.json();
    if (!response.ok)
      setError(
        payload.error?.message ?? "Transkription konnte nicht gestartet werden",
      );
    else await load();
  };
  const summarize = async () => {
    if (!selected || !providerId || !model) return;
    const response = await fetch(`/api/v1/meetings/${selected.id}/summarize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerConfigId: providerId, model }),
    });
    const payload = await response.json();
    if (!response.ok)
      return setError(
        payload.error?.message ?? "Zusammenfassung fehlgeschlagen",
      );
    setSelected(payload.data.meeting);
    await load();
  };
  const provider = providers.find((item) => item.id === providerId);
  return (
    <div className="content-area feature-hub">
      <section className="hub-title">
        <div>
          <span className="eyebrow">Scope Capture</span>
          <h1>Meetings</h1>
          <p>
            Aufnehmen, transkribieren und Entscheidungen in überprüfbare
            Aufgaben verwandeln.
          </p>
        </div>
        {recording && (
          <button className="recording-pill" onClick={stop}>
            <i /> Aufnahme beenden
          </button>
        )}
      </section>
      <div className="dashboard-columns meeting-layout">
        <section className="feature-card">
          <div className="section-heading">
            <div>
              <h2>
                <Mic2 size={17} /> Neues Meeting
              </h2>
              <small>Live aufnehmen oder Datei importieren</small>
            </div>
          </div>
          <label>
            Titel
            <input
              placeholder="Weekly Planning"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <div className="field-row">
            <label>
              Projekt
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                {projects.map((project) => (
                  <option value={project.id} key={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quelle
              <select
                value={source}
                onChange={(event) =>
                  setSource(event.target.value as "live" | "upload")
                }
              >
                <option value="live">Liveaufnahme</option>
                <option value="upload">Audio-/Videodatei</option>
              </select>
            </label>
          </div>
          {source === "upload" && (
            <label className="logo-upload">
              <span>
                <Upload size={17} /> Meetingdatei wählen
              </span>
              <input
                type="file"
                accept="audio/*,video/*"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <small>{file?.name ?? "Audio oder Video bis 250 MB"}</small>
            </label>
          )}
          <label className="consent-check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>
              Alle Teilnehmenden haben der Aufnahme und Verarbeitung zugestimmt.
            </span>
          </label>
          <button
            className="primary-button"
            disabled={
              recording ||
              !consent ||
              !title.trim() ||
              (source === "upload" && !file)
            }
            onClick={() => void create()}
          >
            {source === "live" ? (
              <>
                <Mic2 size={16} /> Aufnahme starten
              </>
            ) : (
              <>
                <Upload size={16} /> Meeting importieren
              </>
            )}
          </button>
        </section>
        <section className="feature-card">
          <div className="section-heading">
            <div>
              <h2>
                <Clock3 size={17} /> Verlauf
              </h2>
              <small>{meetings.length} Meetings</small>
            </div>
          </div>
          <div className="meeting-list">
            {meetings.length === 0 && (
              <p className="empty-copy">Noch keine Meetings erfasst.</p>
            )}
            {meetings.map((meeting) => (
              <article key={meeting.id}>
                <button onClick={() => openMeeting(meeting)}>
                  <span>
                    <strong>{meeting.title}</strong>
                    <small>
                      {projects.find(
                        (project) => project.id === meeting.projectId,
                      )?.name ?? "Ohne Projekt"}{" "}
                      ·{" "}
                      {new Intl.DateTimeFormat("de-DE", {
                        dateStyle: "medium",
                      }).format(new Date(meeting.createdAt))}
                    </small>
                  </span>
                  <i>{meeting.status}</i>
                </button>
                {meeting.recordingAttachmentId && !meeting.transcript && (
                  <button
                    className="secondary-button compact"
                    onClick={() => void transcribe(meeting)}
                  >
                    Transkribieren
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
      {selected && (
        <section className="feature-card meeting-editor">
          <div className="section-heading">
            <div>
              <h2>{selected.title}</h2>
              <small>
                Transkript kann vor der KI-Auswertung korrigiert werden.
              </small>
            </div>
            <button
              className="icon-button compact"
              onClick={() => setSelected(null)}
            >
              <X size={16} />
            </button>
          </div>
          <textarea
            rows={10}
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            placeholder="Transkript erscheint hier oder kann eingefügt werden …"
          />
          <div className="meeting-actions">
            <button
              className="secondary-button"
              disabled={transcript === selected.transcript}
              onClick={() => void saveTranscript()}
            >
              Transkript speichern
            </button>
            <select
              value={providerId}
              onChange={(event) => {
                const next = providers.find(
                  (item) => item.id === event.target.value,
                );
                setProviderId(event.target.value);
                setModel(next?.models[0] ?? "");
              }}
            >
              {providers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              {provider?.models.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              className="primary-button"
              disabled={!transcript.trim() || !model}
              onClick={() => void summarize()}
            >
              <Sparkles size={16} /> Zusammenfassen
            </button>
          </div>
          {selected.summary?.overview && (
            <div className="meeting-summary">
              <span className="proposal-fold">
                <Sparkles size={14} />
              </span>
              <div>
                <h3>Scope AI Summary</h3>
                <p>{selected.summary.overview}</p>
                <strong>Entscheidungen</strong>
                {selected.summary.decisions?.map((item, index) => (
                  <p key={index}>• {item.text}</p>
                ))}
                <strong>Vorgeschlagene Aufgaben</strong>
                {selected.summary.actionItems?.map((item, index) => (
                  <p key={index}>• {item.title}</p>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
      {error && (
        <p className="subscription-note" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type AutomationRecord = {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "paused" | "disabled";
  trigger: { type: string };
  actions: Array<{ type: string; config: Record<string, unknown> }>;
  lastRunAt?: string | null;
};
function AutomationsHub({
  workspaceId,
  projectId,
  canAdmin,
}: {
  workspaceId: string;
  projectId: string;
  canAdmin: boolean;
}) {
  const [items, setItems] = useState<AutomationRecord[]>([]);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("task.created");
  const [message, setMessage] = useState("Aufgabe benötigt Aufmerksamkeit");
  const [error, setError] = useState("");
  const load = async () => {
    const response = await fetch(
      `/api/v1/automations?workspaceId=${workspaceId}`,
      { cache: "no-store" },
    );
    const payload = await response.json();
    if (response.ok) setItems(payload.data);
  };
  useEffect(() => {
    void load();
  }, [workspaceId]);
  const create = async () => {
    const response = await fetch("/api/v1/automations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        projectId: projectId || null,
        name: name.trim(),
        description: "Mit Scope erstellt",
        status: canAdmin ? "active" : "draft",
        trigger: { type: trigger },
        conditions: [],
        actions: [
          {
            type: "notification.send",
            config: { title: name.trim(), body: message },
          },
        ],
      }),
    });
    const payload = await response.json();
    if (!response.ok)
      return setError(
        payload.error?.message ?? "Automation konnte nicht erstellt werden",
      );
    setName("");
    await load();
  };
  const toggle = async (item: AutomationRecord) => {
    const response = await fetch(`/api/v1/automations/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: item.status === "active" ? "paused" : "active",
      }),
    });
    const payload = await response.json();
    if (!response.ok)
      return setError(
        payload.error?.message ?? "Automation konnte nicht geändert werden",
      );
    await load();
  };
  return (
    <div className="content-area feature-hub">
      <section className="hub-title">
        <div>
          <span className="eyebrow">No-code Workflows</span>
          <h1>Automationen</h1>
          <p>
            Wiederkehrende Abläufe zuverlässig ausführen – ohne Skripte und mit
            vollständigem Verlauf.
          </p>
        </div>
        <span className="safety-badge">
          <CheckCircle2 size={16} /> Sichere Aktionen
        </span>
      </section>
      <div className="dashboard-columns">
        <section className="feature-card automation-builder">
          <div className="section-heading">
            <div>
              <h2>
                <Workflow size={17} /> Neue Regel
              </h2>
              <small>
                Wenn etwas passiert, führt Scope freigegebene Aktionen aus.
              </small>
            </div>
          </div>
          <label>
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Review-Zuweisung melden"
            />
          </label>
          <label>
            Wenn …
            <select
              value={trigger}
              onChange={(event) => setTrigger(event.target.value)}
            >
              <option value="task.created">Aufgabe erstellt</option>
              <option value="task.updated">Aufgabe geändert</option>
              <option value="comment.created">Kommentar erstellt</option>
              <option value="milestone.at_risk">Meilenstein gefährdet</option>
            </select>
          </label>
          <label>
            Dann Benachrichtigung senden
            <textarea
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
          <button
            className="primary-button"
            disabled={!name.trim()}
            onClick={() => void create()}
          >
            <Zap size={15} />{" "}
            {canAdmin ? "Automation aktivieren" : "Entwurf speichern"}
          </button>
          <p className="subscription-note">
            Maximal zehn Aktionen pro Lauf. Löschen, Mitglieder und Sicherheit
            sind ausgeschlossen.
          </p>
        </section>
        <section className="feature-card">
          <div className="section-heading">
            <div>
              <h2>
                <Repeat2 size={17} /> Regeln
              </h2>
              <small>
                {items.filter((item) => item.status === "active").length} aktiv
              </small>
            </div>
          </div>
          <div className="automation-list">
            {items.length === 0 && (
              <p className="empty-copy">Noch keine Regeln angelegt.</p>
            )}
            {items.map((item) => (
              <article key={item.id}>
                <span className={`automation-state ${item.status}`}>
                  <Zap size={15} />
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    Wenn {item.trigger.type} · {item.actions.length} Aktion
                    {item.actions.length === 1 ? "" : "en"}
                  </small>
                </span>
                <button
                  className="secondary-button compact"
                  disabled={!canAdmin && item.status !== "active"}
                  onClick={() => void toggle(item)}
                >
                  {item.status === "active" ? "Pausieren" : "Aktivieren"}
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
      {error && (
        <p className="subscription-note" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type AdminData = {
  version: string;
  database: string;
  worker: {
    jobs: Array<{ status: string; count: number }>;
    failed: Array<{ id: string; type: string; error?: string }>;
  };
  storage: { provider: string; bytes: number; maxAttachmentBytes: number };
  services: {
    smtpConfigured: boolean;
    pushConfigured: boolean;
    transcriberConfigured: boolean;
  };
  updateChecksEnabled: boolean;
  backup: { databaseCommand: string; filesCommand: string };
};
function AdminHub({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [copied, setCopied] = useState("");
  const load = async () => {
    const response = await fetch(
      `/api/v1/admin/instance?workspaceId=${workspaceId}`,
      { cache: "no-store" },
    );
    const payload = await response.json();
    if (response.ok) setData(payload.data);
  };
  useEffect(() => {
    void load();
  }, [workspaceId]);
  const copy = async (value: string, id: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied(""), 1800);
  };
  const queued =
    data?.worker.jobs.find((item) => item.status === "queued")?.count ?? 0;
  const failed =
    data?.worker.jobs.find((item) => item.status === "failed")?.count ?? 0;
  return (
    <div className="content-area feature-hub">
      <section className="hub-title">
        <div>
          <span className="eyebrow">Instance Control</span>
          <h1>Self-Hosting</h1>
          <p>
            Instanz, Speicher und Hintergrunddienste ohne Telemetrie überwachen.
          </p>
        </div>
        <span className="safety-badge">
          <CircleDot size={16} /> Version {data?.version ?? "…"}
        </span>
      </section>
      <div className="metric-grid admin-metrics">
        {[
          ["Datenbank", data?.database === "connected" ? "Bereit" : "Prüfen"],
          ["Jobqueue", `${queued} wartend`],
          ["Fehler", failed],
          ["Speicher", formatBytes(data?.storage.bytes ?? 0)],
          ["Storage", data?.storage.provider ?? "local"],
          [
            "Transcriber",
            data?.services.transcriberConfigured ? "Verbunden" : "Optional",
          ],
        ].map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="feature-card">
          <div className="section-heading">
            <div>
              <h2>
                <Server size={17} /> Dienste
              </h2>
              <small>Aktueller Instanzzustand</small>
            </div>
          </div>
          <div className="service-list">
            <div>
              <span>Datenbank</span>
              <b className="ok">Verbunden</b>
            </div>
            <div>
              <span>Dateispeicher</span>
              <b className="ok">{data?.storage.provider ?? "Lokal"}</b>
            </div>
            <div>
              <span>SMTP</span>
              <b>
                {data?.services.smtpConfigured
                  ? "Konfiguriert"
                  : "Nicht eingerichtet"}
              </b>
            </div>
            <div>
              <span>Web Push</span>
              <b>
                {data?.services.pushConfigured
                  ? "Konfiguriert"
                  : "Nicht eingerichtet"}
              </b>
            </div>
            <div>
              <span>Lokale Transkription</span>
              <b>
                {data?.services.transcriberConfigured
                  ? "Verbunden"
                  : "Nicht aktiviert"}
              </b>
            </div>
          </div>
        </section>
        <section className="feature-card">
          <div className="section-heading">
            <div>
              <h2>
                <Archive size={17} /> Backup
              </h2>
              <small>Wiederherstellbare Datenbank- und Dateisicherung</small>
            </div>
          </div>
          <div className="command-card">
            <small>Datenbank sichern</small>
            <code>{data?.backup.databaseCommand}</code>
            <button
              className="secondary-button compact"
              onClick={() =>
                data && void copy(data.backup.databaseCommand, "db")
              }
            >
              {copied === "db" ? "Kopiert" : "Befehl kopieren"}
            </button>
          </div>
          <div className="command-card">
            <small>Dateien sichern</small>
            <code>{data?.backup.filesCommand}</code>
            <button
              className="secondary-button compact"
              onClick={() =>
                data && void copy(data.backup.filesCommand, "files")
              }
            >
              {copied === "files" ? "Kopiert" : "Befehl kopieren"}
            </button>
          </div>
          <p className="subscription-note">
            Scope erhält bewusst keinen Zugriff auf den Docker-Socket. Restore
            und Updates bleiben explizite Admin-Aktionen.
          </p>
        </section>
      </div>
      {Boolean(data?.worker.failed.length) && (
        <section className="feature-card">
          <div className="section-heading">
            <h2>Fehlgeschlagene Jobs</h2>
          </div>
          {data?.worker.failed.map((job) => (
            <div className="failed-job" key={job.id}>
              <strong>{job.type}</strong>
              <code>{job.error || "Unbekannter Fehler"}</code>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function MobileNav({
  nav,
  setNav,
  onMore,
}: {
  nav: string;
  setNav: (nav: string) => void;
  onMore: () => void;
}) {
  return (
    <nav className="mobile-nav">
      <button
        className={nav === "my-work" ? "active" : ""}
        onClick={() => setNav("my-work")}
      >
        <CircleDot />
        <span>Arbeit</span>
      </button>
      <button
        className={nav === "project" ? "active" : ""}
        onClick={() => setNav("project")}
      >
        <Grid2X2 />
        <span>Projekte</span>
      </button>
      <button
        className={nav === "calendar" ? "active" : ""}
        onClick={() => setNav("calendar")}
      >
        <CalendarDays />
        <span>Kalender</span>
      </button>
      <button onClick={onMore}>
        <Menu />
        <span>Mehr</span>
      </button>
    </nav>
  );
}

function NewTaskDialog({
  projectName,
  onClose,
  onAdd,
}: {
  projectName: string;
  onClose: () => void;
  onAdd: (
    title: string,
    description: string,
    due: string,
    priority: Priority,
  ) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  return (
    <div
      className="modal-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <form
        className="task-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim()) onAdd(title.trim(), description, due, priority);
        }}
      >
        <header>
          <span className="project-glyph small">{projectName.slice(0, 1)}</span>
          <span>{projectName}</span>
          <button
            type="button"
            className="icon-button compact"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>
        <input
          ref={input}
          className="task-title-input"
          placeholder="Was muss erledigt werden?"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          placeholder="Beschreibung hinzufügen …"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="dialog-options">
          <label>
            <CalendarDays size={15} />
            <input
              type="date"
              value={due}
              onChange={(event) => setDue(event.target.value)}
            />
          </label>
          <label>
            <Zap size={15} />
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
            >
              <option value="low">Niedrig</option>
              <option value="medium">Mittel</option>
              <option value="high">Hoch</option>
              <option value="urgent">Dringend</option>
            </select>
          </label>
        </div>
        <footer>
          <span>
            <kbd>C</kbd> öffnet diesen Dialog überall
          </span>
          <button
            className="primary-button"
            disabled={!title.trim()}
            type="submit"
          >
            Aufgabe erstellen
          </button>
        </footer>
      </form>
    </div>
  );
}

function ProjectDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (
    name: string,
    description: string,
    key: string,
    color: string,
  ) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [key, setKey] = useState("NEW");
  const [color, setColor] = useState("#8CA8FF");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div
      className="modal-layer"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <form
        className="task-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setError("");
          void onCreate(
            name.trim(),
            description.trim(),
            key.trim().toUpperCase(),
            color,
          ).catch((reason) => {
            setError(
              reason instanceof Error
                ? reason.message
                : "Projekt konnte nicht erstellt werden",
            );
            setLoading(false);
          });
        }}
      >
        <header>
          <span className="project-glyph small">{name.slice(0, 1) || "P"}</span>
          <span>Neues Projekt</span>
          <button
            type="button"
            className="icon-button compact"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>
        <input
          autoFocus
          className="task-title-input"
          placeholder="Projektname"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <textarea
          placeholder="Beschreibung"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="field-row">
          <label>
            Projektkürzel
            <input
              value={key}
              maxLength={8}
              onChange={(event) =>
                setKey(event.target.value.replace(/[^a-z0-9]/gi, ""))
              }
            />
          </label>
          <label>
            Farbe
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </label>
        </div>
        {error && (
          <p className="subscription-note" role="alert">
            {error}
          </p>
        )}
        <footer>
          <span>Das Kürzel erscheint vor Aufgabennummern.</span>
          <button
            className="primary-button"
            disabled={loading || !name.trim() || key.length < 2}
          >
            {loading ? "Erstellen…" : "Projekt erstellen"}
          </button>
        </footer>
      </form>
    </div>
  );
}

const projectIconOptions = [
  { id: "folder", label: "Ordner", icon: Folder },
  { id: "code", label: "Code", icon: Code2 },
  { id: "rocket", label: "Launch", icon: Rocket },
  { id: "megaphone", label: "Marketing", icon: Megaphone },
  { id: "target", label: "Ziel", icon: Target },
  { id: "briefcase", label: "Business", icon: Briefcase },
  { id: "palette", label: "Design", icon: Palette },
  { id: "globe", label: "Web", icon: Globe2 },
] as const;

function ProjectGlyph({
  project,
  size = "normal",
}: {
  project: Pick<BackendProject, "name" | "color" | "icon" | "logoDataUrl">;
  size?: "small" | "normal" | "large";
}) {
  const Icon =
    projectIconOptions.find((item) => item.id === project.icon)?.icon ?? Folder;
  return (
    <span
      className={`project-visual ${size}`}
      style={{ background: project.color }}
    >
      {project.logoDataUrl ? (
        <img src={project.logoDataUrl} alt="" />
      ) : (
        <Icon aria-hidden="true" />
      )}
    </span>
  );
}

function ProjectDialogV2({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (
    name: string,
    description: string,
    key: string,
    color: string,
    icon: string,
    logoDataUrl: string | null,
  ) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [key, setKey] = useState("NEW");
  const [color, setColor] = useState("#8CA8FF");
  const [icon, setIcon] = useState("folder");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const chooseLogo = (file?: File) => {
    if (!file) return;
    if (
      !/[.](png|jpe?g|webp)$/i.test(file.name) ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    )
      return setError("Bitte PNG, JPG oder WebP auswählen.");
    if (file.size > 500_000)
      return setError("Das Projektlogo darf höchstens 500 KB groß sein.");
    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUrl(String(reader.result));
      setError("");
    };
    reader.readAsDataURL(file);
  };
  const preview = { name: name || "Projekt", color, icon, logoDataUrl };
  return (
    <div
      className="modal-layer"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <form
        className="task-dialog project-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setError("");
          void onCreate(
            name.trim(),
            description.trim(),
            key.trim().toUpperCase(),
            color,
            icon,
            logoDataUrl,
          ).catch((reason) => {
            setError(
              reason instanceof Error
                ? reason.message
                : "Projekt konnte nicht erstellt werden",
            );
            setLoading(false);
          });
        }}
      >
        <header>
          <ProjectGlyph project={preview} size="small" />
          <span>Neues Projekt</span>
          <button
            type="button"
            className="icon-button compact"
            aria-label="Schließen"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>
        <div className="project-dialog-body">
          <div className="project-preview">
            <ProjectGlyph project={preview} size="large" />
            <div>
              <strong>{name || "Unbenanntes Projekt"}</strong>
              <small>
                {key || "KEY"} · {description || "Projektbeschreibung"}
              </small>
            </div>
          </div>
          <label>
            Projektname
            <input
              autoFocus
              placeholder="Zum Beispiel Website Relaunch"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Beschreibung
            <textarea
              placeholder="Worum geht es in diesem Projekt?"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="field-row">
            <label>
              Projektkürzel
              <input
                value={key}
                maxLength={8}
                onChange={(event) =>
                  setKey(event.target.value.replace(/[^a-z0-9]/gi, ""))
                }
              />
            </label>
            <label>
              Akzentfarbe
              <input
                className="color-input"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
            </label>
          </div>
          <fieldset className="icon-picker">
            <legend>Icon</legend>
            {projectIconOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  type="button"
                  title={option.label}
                  aria-label={option.label}
                  aria-pressed={icon === option.id && !logoDataUrl}
                  className={icon === option.id && !logoDataUrl ? "active" : ""}
                  key={option.id}
                  onClick={() => {
                    setIcon(option.id);
                    setLogoDataUrl(null);
                  }}
                >
                  <Icon size={18} />
                </button>
              );
            })}
          </fieldset>
          <label className="logo-upload">
            <span>
              <Upload size={17} /> Eigenes Projektlogo
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => chooseLogo(event.target.files?.[0])}
            />
            <small>PNG, JPG oder WebP · maximal 500 KB</small>
          </label>
          {logoDataUrl && (
            <button
              type="button"
              className="secondary-button compact"
              onClick={() => setLogoDataUrl(null)}
            >
              Eigenes Logo entfernen
            </button>
          )}
          {error && (
            <p className="subscription-note" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer>
          <span>Icon und Logo können später erweitert werden.</span>
          <button
            className="primary-button"
            disabled={loading || !name.trim() || key.length < 2}
          >
            {loading ? "Erstellen…" : "Projekt erstellen"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ShareDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className="modal-layer"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="task-dialog">
        <header>
          <span className="project-glyph small">
            <Users size={16} />
          </span>
          <span>Workspace teilen</span>
          <button className="icon-button compact" onClick={onClose}>
            <X size={17} />
          </button>
        </header>
        <p className="lead">
          Dieser Link ist sieben Tage gültig und wird bei der Registrierung
          einmalig eingelöst.
        </p>
        <div className="invite-box">
          <div>
            <small>Einladungslink</small>
            <code>{url}</code>
          </div>
          <button
            className="icon-button"
            aria-label="Link kopieren"
            onClick={() => {
              void navigator.clipboard.writeText(url);
              setCopied(true);
            }}
          >
            <Link2 size={17} />
          </button>
          {copied && <span className="copied">Kopiert</span>}
        </div>
        <footer>
          <span>Rolle: Mitglied</span>
          <button className="primary-button" onClick={onClose}>
            Fertig
          </button>
        </footer>
      </div>
    </div>
  );
}

type TaskComment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
};
type TaskActivity = {
  id: string;
  actorType: string;
  entityId: string;
  action: string;
  undoPayload?: unknown;
  undoneAt?: string | null;
  createdAt: string;
};

function TaskPanel({
  task,
  workspaceId,
  account,
  onClose,
  onUpdate,
  onComment,
  onDelete,
  onChanged,
}: {
  task: Task;
  workspaceId: string;
  account: AccountState;
  onClose: () => void;
  onUpdate: (
    id: string,
    patch: Partial<
      Pick<Task, "status" | "priority" | "dueDate" | "title" | "description">
    >,
  ) => Promise<void>;
  onComment: (id: string, body: string) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [sending, setSending] = useState(false);
  const [description, setDescription] = useState(task.description);
  const initials = account.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const loadComments = async () => {
    const response = await fetch(`/api/v1/tasks/${task.id}/comments`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (response.ok) setComments(payload.data);
  };
  const loadActivity = async () => {
    const response = await fetch(
      `/api/v1/activity?workspaceId=${workspaceId}`,
      { cache: "no-store" },
    );
    const payload = await response.json();
    if (response.ok)
      setActivity(
        (payload.data as TaskActivity[])
          .filter((event) => event.entityId === task.id)
          .slice(0, 12),
      );
  };
  useEffect(() => {
    void loadComments();
    void loadActivity();
  }, [task.id]);
  const submitComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try {
      await onComment(task.id, comment.trim());
      setComment("");
      await loadComments();
    } finally {
      setSending(false);
    }
  };
  const undo = async (eventId: string) => {
    const response = await fetch(`/api/v1/activity/${eventId}/undo`, {
      method: "POST",
    });
    if (response.ok) {
      await onChanged();
      await loadActivity();
      onClose();
    }
  };
  return (
    <div
      className="panel-scrim"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside className="detail-panel">
        <header>
          <span>{task.key}</span>
          <div>
            <button
              className="icon-button compact"
              aria-label="Aufgabe löschen"
              onClick={() => void onDelete(task)}
            >
              <Archive size={17} />
            </button>
            <button className="icon-button compact" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="detail-content">
          <select
            className={`status-select ${task.status}`}
            value={task.status}
            onChange={(event) =>
              void onUpdate(task.id, {
                status: event.target.value as TaskStatus,
              })
            }
          >
            {statusOrder.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
          <h1>{task.title}</h1>
          <div className="editable-description">
            <textarea
              aria-label="Aufgabenbeschreibung"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Beschreibung hinzufügen …"
              rows={4}
            />
            <button
              className="secondary-button compact"
              disabled={description === task.description}
              onClick={() => void onUpdate(task.id, { description })}
            >
              Beschreibung speichern
            </button>
          </div>
          <div className="property-list">
            <div>
              <span>
                <Zap /> Priorität
              </span>
              <select
                aria-label="Priorität"
                value={task.priority}
                onChange={(event) =>
                  void onUpdate(task.id, {
                    priority: event.target.value as Priority,
                  })
                }
              >
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span>
                <UserRound /> Verantwortlich
              </span>
              <strong>
                <i className="avatar small">{task.assignee}</i>{" "}
                {task.assignee === "–" ? "Nicht zugewiesen" : "Zugewiesen"}
              </strong>
            </div>
            <div>
              <span>
                <CalendarDays /> Fällig
              </span>
              <input
                aria-label="Fälligkeitsdatum"
                type="date"
                value={task.dueDate}
                onChange={(event) =>
                  void onUpdate(task.id, { dueDate: event.target.value })
                }
              />
            </div>
            <div>
              <span>
                <Hash /> Labels
              </span>
              <strong>{task.labels.join(", ") || "Keine"}</strong>
            </div>
          </div>
          {task.subtasks.length > 0 && (
            <section className="subtasks">
              <div>
                <h2>Unteraufgaben</h2>
                <span>
                  {task.subtasks.filter((item) => item.done).length}/
                  {task.subtasks.length}
                </span>
              </div>
              {task.subtasks.map((item) => (
                <label key={item.id}>
                  <input type="checkbox" checked={item.done} readOnly />
                  <span>{item.title}</span>
                </label>
              ))}
            </section>
          )}
          <section className="activity">
            <h2>Aktivität</h2>
            {activity.map((item) => (
              <div className="activity-item" key={item.id}>
                <span className="avatar small">
                  {item.actorType === "ai" ? "AI" : initials}
                </span>
                <p>
                  <strong>
                    {item.actorType === "ai" ? "Scope Assist" : account.name}
                  </strong>
                  {activityLabel(item.action)}
                  <small>
                    {new Intl.DateTimeFormat("de-DE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.createdAt))}
                  </small>
                </p>
                {Boolean(item.undoPayload) && !item.undoneAt && (
                  <button
                    className="secondary-button compact"
                    onClick={() => void undo(item.id)}
                  >
                    Rückgängig
                  </button>
                )}
              </div>
            ))}
          </section>
          <section className="activity">
            <h2>Kommentare</h2>
            {comments.length === 0 && (
              <p className="subscription-note">Noch keine Kommentare.</p>
            )}
            {comments.map((item) => (
              <div className="activity-item" key={item.id}>
                <span className="avatar small">
                  {item.author.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <p>
                  <strong>{item.author.name}</strong>
                  {item.body}
                  <small>
                    {new Intl.DateTimeFormat("de-DE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.createdAt))}
                  </small>
                </p>
              </div>
            ))}
            <form
              className="comment-box"
              onSubmit={(event) => {
                event.preventDefault();
                void submitComment();
              }}
            >
              <span className="avatar small">{initials}</span>
              <input
                placeholder="Kommentar schreiben …"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
              <button
                disabled={sending || !comment.trim()}
                aria-label="Kommentar senden"
              >
                <ArrowRight size={15} />
              </button>
            </form>
          </section>
        </div>
      </aside>
    </div>
  );
}

type WorkspaceLabel = { id: string; name: string; color: string };
type AttachmentRecord = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  aiAllowed: boolean;
};

function TaskPanelV2({
  task,
  workspaceId,
  account,
  onClose,
  onUpdate,
  onComment,
  onDelete,
  onChanged,
}: {
  task: Task;
  workspaceId: string;
  account: AccountState;
  onClose: () => void;
  onUpdate: (
    id: string,
    patch: Partial<
      Pick<
        Task,
        | "status"
        | "priority"
        | "dueDate"
        | "title"
        | "description"
        | "assigneeId"
        | "milestoneId"
      >
    >,
  ) => Promise<void>;
  onComment: (id: string, body: string) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [labels, setLabels] = useState<WorkspaceLabel[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [workspaceTasks, setWorkspaceTasks] = useState<Task[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [blockerId, setBlockerId] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [nextOccurrence, setNextOccurrence] = useState("");
  const [selectedLabelIds, setSelectedLabelIds] = useState(task.labelIds ?? []);
  const [newLabel, setNewLabel] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#8CA8FF");
  const [subtask, setSubtask] = useState("");
  const [sending, setSending] = useState(false);
  const [description, setDescription] = useState(task.description);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const initials = account.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const loadDetails = async () => {
    const [
      commentResponse,
      activityResponse,
      memberResponse,
      labelResponse,
      milestoneResponse,
      dependencyResponse,
      taskResponse,
      attachmentResponse,
    ] = await Promise.all([
      fetch(`/api/v1/tasks/${task.id}/comments`, { cache: "no-store" }),
      fetch(`/api/v1/activity?workspaceId=${workspaceId}`, {
        cache: "no-store",
      }),
      fetch(`/api/v1/workspaces/${workspaceId}/members`, { cache: "no-store" }),
      fetch(`/api/v1/labels?workspaceId=${workspaceId}`, { cache: "no-store" }),
      fetch(`/api/v1/milestones?projectId=${task.projectId}`, {
        cache: "no-store",
      }),
      fetch(`/api/v1/task-dependencies?taskId=${task.id}`, {
        cache: "no-store",
      }),
      fetch(`/api/v1/tasks?workspaceId=${workspaceId}`, { cache: "no-store" }),
      fetch(
        `/api/v1/attachments?workspaceId=${workspaceId}&entityType=task&entityId=${task.id}`,
        { cache: "no-store" },
      ),
    ]);
    const payloads = await Promise.all(
      [
        commentResponse,
        activityResponse,
        memberResponse,
        labelResponse,
        milestoneResponse,
        dependencyResponse,
        taskResponse,
        attachmentResponse,
      ].map((response) => response.json()),
    );
    if (commentResponse.ok) setComments(payloads[0].data);
    if (activityResponse.ok)
      setActivity(
        (payloads[1].data as TaskActivity[])
          .filter((event) => event.entityId === task.id)
          .slice(0, 12),
      );
    if (memberResponse.ok) setMembers(payloads[2].data);
    if (labelResponse.ok) setLabels(payloads[3].data);
    if (milestoneResponse.ok) setMilestones(payloads[4].data);
    if (dependencyResponse.ok) setDependencies(payloads[5].data);
    if (taskResponse.ok) setWorkspaceTasks(payloads[6].data);
    if (attachmentResponse.ok) setAttachments(payloads[7].data);
  };
  useEffect(() => {
    setDescription(task.description);
    setSelectedLabelIds(task.labelIds ?? []);
    void loadDetails();
  }, [task.id]);
  const submitComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try {
      await onComment(task.id, comment.trim());
      setComment("");
      await loadDetails();
    } finally {
      setSending(false);
    }
  };
  const saveLabels = async (ids: string[]) => {
    setSelectedLabelIds(ids);
    const response = await fetch(`/api/v1/tasks/${task.id}/labels`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ labelIds: ids }),
    });
    if (response.ok) await onChanged();
    else setSelectedLabelIds(task.labelIds ?? []);
  };
  const createLabel = async () => {
    if (!newLabel.trim()) return;
    const response = await fetch("/api/v1/labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        name: newLabel.trim(),
        color: newLabelColor,
      }),
    });
    const payload = await response.json();
    if (!response.ok) return;
    const created = payload.data as WorkspaceLabel;
    setLabels((current) => [...current, created]);
    setNewLabel("");
    await saveLabels([...selectedLabelIds, created.id]);
  };
  const createSubtask = async () => {
    if (!subtask.trim() || !task.projectId) return;
    const response = await fetch("/api/v1/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        projectId: task.projectId,
        parentId: task.id,
        title: subtask.trim(),
      }),
    });
    if (response.ok) {
      setSubtask("");
      await onChanged();
      onClose();
    }
  };
  const addDependency = async () => {
    if (!blockerId) return;
    const response = await fetch("/api/v1/task-dependencies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        blockerTaskId: blockerId,
        blockedTaskId: task.id,
      }),
    });
    if (response.ok) {
      setBlockerId("");
      await loadDetails();
      await onChanged();
    }
  };
  const removeDependency = async (id: string) => {
    const response = await fetch(`/api/v1/task-dependencies/${id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      await loadDetails();
      await onChanged();
    }
  };
  const uploadAttachment = async (file?: File) => {
    if (!file) return;
    const form = new FormData();
    form.set("workspaceId", workspaceId);
    form.set("projectId", task.projectId ?? "");
    form.set("entityType", "task");
    form.set("entityId", task.id);
    form.set("file", file);
    const response = await fetch("/api/v1/attachments", {
      method: "POST",
      body: form,
    });
    if (response.ok) await loadDetails();
  };
  const createRecurrence = async () => {
    if (!nextOccurrence || !task.projectId) return;
    const response = await fetch("/api/v1/recurrence-rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: task.projectId,
        frequency,
        interval: 1,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        generationMode: "schedule",
        nextOccurrenceAt: new Date(`${nextOccurrence}T09:00:00`).toISOString(),
        taskTemplate: {
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: "backlog",
          assigneeId: task.assigneeId ?? null,
          milestoneId: task.milestoneId ?? null,
          dueOffsetDays: 0,
          labelIds: task.labelIds ?? [],
        },
      }),
    });
    if (response.ok) setNextOccurrence("");
  };
  const undo = async (eventId: string) => {
    const response = await fetch(`/api/v1/activity/${eventId}/undo`, {
      method: "POST",
    });
    if (response.ok) {
      await onChanged();
      onClose();
    }
  };
  return (
    <div
      className="panel-scrim"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside className="detail-panel">
        <header>
          <span>{task.key}</span>
          <div>
            <button
              className={`icon-button compact ${deleteConfirm ? "danger" : ""}`}
              aria-label={
                deleteConfirm ? "Löschen bestätigen" : "Aufgabe löschen"
              }
              onClick={() => {
                if (deleteConfirm) void onDelete(task);
                else setDeleteConfirm(true);
              }}
            >
              {deleteConfirm ? <Check size={17} /> : <Archive size={17} />}
            </button>
            <button
              className="icon-button compact"
              aria-label="Schließen"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="detail-content">
          <select
            aria-label="Status"
            className={`status-select ${task.status}`}
            value={task.status}
            onChange={(event) =>
              void onUpdate(task.id, {
                status: event.target.value as TaskStatus,
              })
            }
          >
            {statusOrder.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
          <h1>{task.title}</h1>
          <div className="editable-description">
            <textarea
              aria-label="Aufgabenbeschreibung"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Beschreibung hinzufügen …"
              rows={4}
            />
            <button
              className="secondary-button compact"
              disabled={description === task.description}
              onClick={() => void onUpdate(task.id, { description })}
            >
              Beschreibung speichern
            </button>
          </div>
          <div className="property-list">
            <div>
              <span>
                <Zap /> Priorität
              </span>
              <select
                aria-label="Priorität"
                value={task.priority}
                onChange={(event) =>
                  void onUpdate(task.id, {
                    priority: event.target.value as Priority,
                  })
                }
              >
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span>
                <UserRound /> Verantwortlich
              </span>
              <select
                aria-label="Verantwortliche Person"
                value={task.assigneeId ?? ""}
                onChange={(event) =>
                  void onUpdate(task.id, {
                    assigneeId: event.target.value || null,
                  })
                }
              >
                <option value="">Nicht zugewiesen</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span>
                <CalendarDays /> Fällig
              </span>
              <input
                aria-label="Fälligkeitsdatum"
                type="date"
                value={task.dueDate}
                onChange={(event) =>
                  void onUpdate(task.id, { dueDate: event.target.value })
                }
              />
            </div>
            <div>
              <span>
                <Flag /> Meilenstein
              </span>
              <select
                aria-label="Meilenstein"
                value={task.milestoneId ?? ""}
                onChange={(event) =>
                  void onUpdate(task.id, {
                    milestoneId: event.target.value || null,
                  })
                }
              >
                <option value="">Kein Meilenstein</option>
                {milestones.map((milestone) => (
                  <option value={milestone.id} key={milestone.id}>
                    {milestone.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <section className="label-manager">
            <div className="section-heading">
              <h2>Labels</h2>
              <small>{selectedLabelIds.length} ausgewählt</small>
            </div>
            <div className="label-options">
              {labels.map((label) => (
                <button
                  key={label.id}
                  aria-pressed={selectedLabelIds.includes(label.id)}
                  onClick={() =>
                    void saveLabels(
                      selectedLabelIds.includes(label.id)
                        ? selectedLabelIds.filter((id) => id !== label.id)
                        : [...selectedLabelIds, label.id],
                    )
                  }
                >
                  <i style={{ background: label.color }} />
                  {label.name}
                  {selectedLabelIds.includes(label.id) && <Check size={13} />}
                </button>
              ))}
            </div>
            <div className="inline-create">
              <input
                aria-label="Neues Label"
                placeholder="Neues Label"
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
              />
              <input
                aria-label="Labelfarbe"
                type="color"
                value={newLabelColor}
                onChange={(event) => setNewLabelColor(event.target.value)}
              />
              <button
                className="secondary-button compact"
                disabled={!newLabel.trim()}
                onClick={() => void createLabel()}
              >
                <Plus size={14} /> Anlegen
              </button>
            </div>
          </section>
          <section className="relation-manager">
            <div className="section-heading">
              <h2>
                <GitBranch size={16} /> Abhängigkeiten
              </h2>
              <small>
                {
                  dependencies.filter((edge) => edge.blockedTaskId === task.id)
                    .length
                }{" "}
                Blocker
              </small>
            </div>
            <div className="dependency-list">
              {dependencies
                .filter((edge) => edge.blockedTaskId === task.id)
                .map((edge) => {
                  const blocker = workspaceTasks.find(
                    (item) => item.id === edge.blockerTaskId,
                  );
                  return (
                    <div key={edge.id}>
                      <span>
                        <i /> Blockiert durch{" "}
                        <strong>{blocker?.title ?? edge.blockerTaskId}</strong>
                      </span>
                      <button
                        className="icon-button compact"
                        aria-label="Abhängigkeit entfernen"
                        onClick={() => void removeDependency(edge.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
            </div>
            <div className="inline-create">
              <select
                aria-label="Blockierende Aufgabe"
                value={blockerId}
                onChange={(event) => setBlockerId(event.target.value)}
              >
                <option value="">Blockierende Aufgabe wählen</option>
                {workspaceTasks
                  .filter(
                    (item) => item.id !== task.id && item.status !== "done",
                  )
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.title}
                    </option>
                  ))}
              </select>
              <button
                className="secondary-button compact"
                disabled={!blockerId}
                onClick={() => void addDependency()}
              >
                <Plus size={14} /> Verknüpfen
              </button>
            </div>
          </section>
          <section className="recurrence-manager">
            <div className="section-heading">
              <h2>
                <Repeat2 size={16} /> Wiederholen
              </h2>
              <small>Neue Instanz automatisch erzeugen</small>
            </div>
            <div className="inline-create">
              <select
                value={frequency}
                onChange={(event) => setFrequency(event.target.value)}
              >
                <option value="daily">Täglich</option>
                <option value="weekly">Wöchentlich</option>
                <option value="monthly">Monatlich</option>
                <option value="yearly">Jährlich</option>
              </select>
              <input
                aria-label="Erste Wiederholung"
                type="date"
                value={nextOccurrence}
                onChange={(event) => setNextOccurrence(event.target.value)}
              />
              <button
                className="secondary-button compact"
                disabled={!nextOccurrence}
                onClick={() => void createRecurrence()}
              >
                <Repeat2 size={14} /> Aktivieren
              </button>
            </div>
          </section>
          <section className="attachment-manager">
            <div className="section-heading">
              <h2>
                <Paperclip size={16} /> Dateien
              </h2>
              <small>{attachments.length} Anhänge</small>
            </div>
            <div className="attachment-list">
              {attachments.map((attachment) => (
                <a
                  href={`/api/v1/attachments/${attachment.id}`}
                  key={attachment.id}
                >
                  <FileText size={15} />
                  <span>
                    <strong>{attachment.originalName}</strong>
                    <small>
                      {formatBytes(attachment.sizeBytes)}
                      {attachment.aiAllowed ? " · für KI freigegeben" : ""}
                    </small>
                  </span>
                  <ExternalLink size={13} />
                </a>
              ))}
            </div>
            <label className="logo-upload">
              <span>
                <Upload size={16} /> Datei hinzufügen
              </span>
              <input
                type="file"
                onChange={(event) =>
                  void uploadAttachment(event.target.files?.[0])
                }
              />
              <small>Privat und nur für Workspace-Mitglieder</small>
            </label>
          </section>
          <section className="subtasks">
            <div>
              <h2>Unteraufgaben</h2>
              <span>
                {task.subtasks.filter((item) => item.done).length}/
                {task.subtasks.length}
              </span>
            </div>
            {task.subtasks.map((item) => (
              <label key={item.id}>
                <input type="checkbox" checked={item.done} readOnly />
                <span>{item.title}</span>
              </label>
            ))}
            <div className="inline-create">
              <input
                aria-label="Neue Unteraufgabe"
                placeholder="Unteraufgabe hinzufügen"
                value={subtask}
                onChange={(event) => setSubtask(event.target.value)}
              />
              <button
                className="secondary-button compact"
                disabled={!subtask.trim()}
                onClick={() => void createSubtask()}
              >
                <Plus size={14} /> Hinzufügen
              </button>
            </div>
          </section>
          <section className="activity">
            <h2>Aktivität</h2>
            {activity.map((item) => (
              <div className="activity-item" key={item.id}>
                <span className="avatar small">
                  {item.actorType === "ai" ? "AI" : initials}
                </span>
                <p>
                  <strong>
                    {item.actorType === "ai" ? "Scope Assist" : account.name}
                  </strong>
                  {activityLabel(item.action)}
                  <small>
                    {new Intl.DateTimeFormat(account.locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.createdAt))}
                  </small>
                </p>
                {Boolean(item.undoPayload) && !item.undoneAt && (
                  <button
                    className="secondary-button compact"
                    onClick={() => void undo(item.id)}
                  >
                    Rückgängig
                  </button>
                )}
              </div>
            ))}
          </section>
          <section className="activity">
            <h2>Kommentare</h2>
            {comments.length === 0 && (
              <p className="subscription-note">Noch keine Kommentare.</p>
            )}
            {comments.map((item) => (
              <div className="activity-item" key={item.id}>
                <span className="avatar small">
                  {item.author.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <p>
                  <strong>{item.author.name}</strong>
                  {item.body}
                  <small>
                    {new Intl.DateTimeFormat(account.locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.createdAt))}
                  </small>
                </p>
              </div>
            ))}
            <form
              className="comment-box"
              onSubmit={(event) => {
                event.preventDefault();
                void submitComment();
              }}
            >
              <span className="avatar small">{initials}</span>
              <input
                placeholder="Kommentar schreiben …"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
              <button
                disabled={sending || !comment.trim()}
                aria-label="Kommentar senden"
              >
                <ArrowRight size={15} />
              </button>
            </form>
          </section>
        </div>
      </aside>
    </div>
  );
}

type PublicProvider = {
  id: string;
  provider: string;
  name: string;
  endpoint?: string | null;
  models: string[];
  enabled: boolean;
};
type WorkspaceMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
};
type AiUsage = {
  month: {
    runs: number;
    inputTokens: number;
    outputTokens: number;
    tokens: number;
    costMicros: number;
  };
  total: { runs: number; tokens: number };
};
type ProposalOperation = {
  id: string;
  type:
    | "task.update"
    | "task.create"
    | "subtask.create"
    | "milestone.create"
    | "dependency.create";
  taskId?: string;
  projectId?: string;
  title?: string;
  patch?: Record<string, string>;
};
type ProposalResult = {
  run: { inputTokens?: number; outputTokens?: number };
  proposal: { id: string; summary: string; operations: ProposalOperation[] };
};

function AssistantPanel({
  workspaceId,
  projectId,
  autonomy,
  setAutonomy,
  onClose,
  onChanged,
}: {
  workspaceId: string;
  projectId: string;
  autonomy: AutonomyLevel;
  setAutonomy: (level: AutonomyLevel) => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<ProposalResult | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(
          `/api/v1/ai/providers?workspaceId=${workspaceId}`,
          { cache: "no-store" },
        );
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload.error?.message ?? "Provider konnten nicht geladen werden",
          );
        const available = (payload.data as PublicProvider[]).filter(
          (provider) => provider.enabled,
        );
        setProviders(available);
        if (available[0]) {
          setProviderId(available[0].id);
          setModel(available[0].models?.[0] ?? "");
        }
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Provider konnten nicht geladen werden",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId]);

  const provider = providers.find((item) => item.id === providerId);
  const run = async () => {
    if (!providerId || !model.trim() || !prompt.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/v1/ai/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          projectId,
          providerConfigId: providerId,
          model: model.trim(),
          autonomy,
          prompt: prompt.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error?.message ?? "KI-Lauf fehlgeschlagen");
      if (autonomy === "suggest") {
        setResult(payload.data);
        setSelected(
          payload.data.proposal.operations.map(
            (operation: ProposalOperation) => operation.id,
          ),
        );
      } else {
        await onChanged();
        onClose();
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "KI-Lauf fehlgeschlagen",
      );
    } finally {
      setLoading(false);
    }
  };
  const resolve = async (action: "apply" | "reject") => {
    if (!result) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/ai/proposals/${result.proposal.id}/${action}`,
        {
          method: "POST",
          headers:
            action === "apply"
              ? { "content-type": "application/json" }
              : undefined,
          body:
            action === "apply"
              ? JSON.stringify({ operationIds: selected })
              : undefined,
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error?.message ?? "Vorschlag konnte nicht verarbeitet werden",
        );
      await onChanged();
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Vorschlag konnte nicht verarbeitet werden",
      );
      setLoading(false);
    }
  };

  return (
    <div
      className="panel-scrim"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside className="detail-panel assistant-panel">
        <header>
          <span>
            <Sparkles size={16} /> Scope Assist
          </span>
          <button className="icon-button compact" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="assistant-content">
          <div className="autonomy-control">
            <div>
              <strong>Arbeitsmodus</strong>
              <small>
                {autonomy === "suggest"
                  ? "Änderungen werden vor dem Anwenden bestätigt."
                  : "Freigegebene Änderungen werden direkt angewendet."}
              </small>
            </div>
            <select
              value={autonomy}
              onChange={(event) =>
                setAutonomy(event.target.value as AutonomyLevel)
              }
            >
              <option value="suggest">Vorschläge</option>
              <option value="automation">Automationen</option>
              <option value="agentic">Agentisch</option>
            </select>
          </div>
          {loading && !providers.length ? (
            <div className="assistant-intro">
              <div className="ai-orbit">
                <ScopeMark size={37} />
              </div>
              <h2>Provider werden geladen…</h2>
            </div>
          ) : providers.length === 0 ? (
            <div className="assistant-intro">
              <div className="ai-orbit">
                <ScopeMark size={37} />
              </div>
              <h2>Noch keine KI verbunden.</h2>
              <p>
                Owner und Admins können unter Einstellungen → KI & Modelle einen
                API- oder lokalen Provider hinzufügen. Der Planner bleibt
                vollständig nutzbar.
              </p>
            </div>
          ) : (
            <>
              <div className="assistant-intro">
                <div className="ai-orbit">
                  <ScopeMark size={37} />
                </div>
                <h2>Was soll sich bewegen?</h2>
                <p>
                  Scope sendet nur die Aufgaben dieses Projekts an den gewählten
                  Provider.
                </p>
              </div>
              <div className="suggestion-chips">
                <button
                  onClick={() =>
                    setPrompt(
                      "Fasse den Projektstatus und alle aktuellen Blocker zusammen.",
                    )
                  }
                >
                  Status zusammenfassen
                </button>
                <button
                  onClick={() =>
                    setPrompt(
                      "Zerlege die größten offenen Aufgaben in klare Unteraufgaben.",
                    )
                  }
                >
                  Aufgaben zerlegen
                </button>
              </div>
              <form
                className="assistant-input"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run();
                }}
              >
                <textarea
                  aria-label="Anweisung an Scope Assist"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={3}
                  placeholder="Beschreibe eine Änderung oder frage nach Risiken …"
                />
                <div className="field-row">
                  <label>
                    Provider
                    <select
                      value={providerId}
                      onChange={(event) => {
                        const next = providers.find(
                          (item) => item.id === event.target.value,
                        );
                        setProviderId(event.target.value);
                        setModel(next?.models?.[0] ?? "");
                      }}
                    >
                      {providers.map((item) => (
                        <option value={item.id} key={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Modell
                    <input
                      list="scope-provider-models"
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      placeholder="Modell-ID"
                    />
                    <datalist id="scope-provider-models">
                      {provider?.models?.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                  </label>
                </div>
                <footer>
                  <span>{provider?.provider} · Kosten beim Provider</span>
                  <button
                    className="icon-button send"
                    aria-label="An Scope Assist senden"
                    disabled={loading || !prompt.trim() || !model.trim()}
                    type="submit"
                  >
                    <ArrowRight size={17} />
                  </button>
                </footer>
              </form>
            </>
          )}
          {error && (
            <p className="subscription-note" role="alert">
              {error}
            </p>
          )}
          {result && (
            <div className="ai-proposal">
              <div className="proposal-head">
                <span className="proposal-fold">
                  <Sparkles size={14} />
                </span>
                <div>
                  <strong>{result.proposal.summary}</strong>
                  <small>
                    {(result.run.inputTokens ?? 0) +
                      (result.run.outputTokens ?? 0)}{" "}
                    gemessene Tokens
                  </small>
                </div>
              </div>
              <div className="diff-list">
                {result.proposal.operations.map((operation) => (
                  <label key={operation.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(operation.id)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, operation.id]
                            : current.filter((id) => id !== operation.id),
                        )
                      }
                    />
                    <span>
                      <i>{operationLabel(operation.type)}</i>
                      <strong>
                        {operation.title ?? operation.taskId ?? "Aufgabe"}
                      </strong>
                      <small>
                        {operation.patch
                          ? JSON.stringify(operation.patch)
                          : "Wird nach Freigabe erstellt"}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
              <footer>
                <button
                  className="secondary-button"
                  disabled={loading}
                  onClick={() => void resolve("reject")}
                >
                  Verwerfen
                </button>
                <button
                  className="primary-button"
                  disabled={loading || selected.length === 0}
                  onClick={() => void resolve("apply")}
                >
                  <Check size={15} /> {selected.length} Änderungen übernehmen
                </button>
              </footer>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

type AssistantProps = {
  workspaceId: string;
  projectId: string;
  autonomy: AutonomyLevel;
  setAutonomy: (level: AutonomyLevel) => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
};

function AssistantPanelV2({
  workspaceId,
  projectId,
  autonomy,
  setAutonomy,
  onClose,
  onChanged,
}: AssistantProps) {
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<ProposalResult | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void (async () => {
      try {
        const [providerResponse, usageResponse] = await Promise.all([
          fetch(`/api/v1/ai/providers?workspaceId=${workspaceId}`, {
            cache: "no-store",
          }),
          fetch(`/api/v1/ai/usage?workspaceId=${workspaceId}`, {
            cache: "no-store",
          }),
        ]);
        const [providerPayload, usagePayload] = await Promise.all([
          providerResponse.json(),
          usageResponse.json(),
        ]);
        if (!providerResponse.ok)
          throw new Error(
            providerPayload.error?.message ??
              "Provider konnten nicht geladen werden",
          );
        const available = (providerPayload.data as PublicProvider[]).filter(
          (provider) => provider.enabled,
        );
        setProviders(available);
        if (available[0]) {
          setProviderId(available[0].id);
          setModel(available[0].models?.[0] ?? "");
        }
        if (usageResponse.ok) setUsage(usagePayload.data);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Provider konnten nicht geladen werden",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId]);
  const provider = providers.find((item) => item.id === providerId);
  const run = async () => {
    if (!providerId || !model || !prompt.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/v1/ai/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          projectId,
          providerConfigId: providerId,
          model,
          autonomy,
          prompt: prompt.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error?.message ?? "KI-Lauf fehlgeschlagen");
      if (autonomy === "suggest") {
        setResult(payload.data);
        setSelected(
          payload.data.proposal.operations.map(
            (operation: ProposalOperation) => operation.id,
          ),
        );
      } else {
        await onChanged();
        onClose();
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "KI-Lauf fehlgeschlagen",
      );
    } finally {
      setLoading(false);
    }
  };
  const resolve = async (action: "apply" | "reject") => {
    if (!result) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/ai/proposals/${result.proposal.id}/${action}`,
        {
          method: "POST",
          headers:
            action === "apply"
              ? { "content-type": "application/json" }
              : undefined,
          body:
            action === "apply"
              ? JSON.stringify({ operationIds: selected })
              : undefined,
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error?.message ?? "Vorschlag konnte nicht verarbeitet werden",
        );
      await onChanged();
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Vorschlag konnte nicht verarbeitet werden",
      );
      setLoading(false);
    }
  };
  return (
    <div
      className="panel-scrim"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside className="detail-panel assistant-panel">
        <header>
          <span>
            <Sparkles size={16} /> Scope Assist
          </span>
          <button
            className="icon-button compact"
            aria-label="Schließen"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="assistant-content">
          <div className="autonomy-control">
            <div>
              <strong>Arbeitsmodus</strong>
              <small>
                {autonomy === "suggest"
                  ? "Änderungen werden vor dem Anwenden bestätigt."
                  : "Freigegebene Änderungen werden direkt angewendet."}
              </small>
            </div>
            <select
              value={autonomy}
              onChange={(event) =>
                setAutonomy(event.target.value as AutonomyLevel)
              }
            >
              <option value="suggest">Vorschläge</option>
              <option value="automation">Automationen</option>
              <option value="agentic">Agentisch</option>
            </select>
          </div>
          {usage && (
            <div className="assistant-usage">
              <BarChart3 size={15} />
              <span>
                <strong>{usage.month.tokens.toLocaleString("de-DE")}</strong>{" "}
                Tokens · {usage.month.runs} Läufe diesen Monat
              </span>
            </div>
          )}
          {loading && !providers.length ? (
            <div className="assistant-intro">
              <div className="ai-orbit">
                <ScopeMark size={37} />
              </div>
              <h2>Provider werden geladen…</h2>
            </div>
          ) : providers.length === 0 ? (
            <div className="assistant-intro">
              <div className="ai-orbit">
                <ScopeMark size={37} />
              </div>
              <h2>Noch keine KI verbunden.</h2>
              <p>
                Owner und Admins können unter Einstellungen → KI & Modelle einen
                Provider hinzufügen.
              </p>
            </div>
          ) : (
            <>
              <div className="assistant-intro">
                <div className="ai-orbit">
                  <ScopeMark size={37} />
                </div>
                <h2>Was soll sich bewegen?</h2>
                <p>
                  Scope Assist kennt den autorisierten Workspace-Kontext:
                  Projekte, Aufgaben, Personen, Labels, Kommentare und Verlauf.
                </p>
              </div>
              <div className="suggestion-chips">
                <button
                  onClick={() =>
                    setPrompt(
                      "Fasse den Projektstatus und alle aktuellen Blocker zusammen.",
                    )
                  }
                >
                  Status zusammenfassen
                </button>
                <button
                  onClick={() =>
                    setPrompt(
                      "Zerlege die größten offenen Aufgaben in klare Unteraufgaben.",
                    )
                  }
                >
                  Aufgaben zerlegen
                </button>
              </div>
              <form
                className="assistant-input"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run();
                }}
              >
                <textarea
                  aria-label="Anweisung an Scope Assist"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={3}
                  placeholder="Beschreibe eine Änderung oder frage nach Risiken …"
                />
                <div className="field-row">
                  <label>
                    Provider
                    <select
                      value={providerId}
                      onChange={(event) => {
                        const next = providers.find(
                          (item) => item.id === event.target.value,
                        );
                        setProviderId(event.target.value);
                        setModel(next?.models?.[0] ?? "");
                      }}
                    >
                      {providers.map((item) => (
                        <option value={item.id} key={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Modell
                    <select
                      aria-label="KI-Modell"
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      disabled={!provider?.models.length}
                    >
                      <option value="">
                        {provider?.models.length
                          ? "Modell auswählen"
                          : "Modelle zuerst in Einstellungen abrufen"}
                      </option>
                      {provider?.models.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <footer>
                  <span>
                    {provider?.provider}
                    {provider?.provider === "gemini"
                      ? " · automatischer Fallback bei Limits"
                      : " · Usage wird gemessen"}
                  </span>
                  <button
                    className="icon-button send"
                    aria-label="An Scope Assist senden"
                    disabled={loading || !prompt.trim() || !model}
                    type="submit"
                  >
                    <ArrowRight size={17} />
                  </button>
                </footer>
              </form>
            </>
          )}
          {error && (
            <p className="subscription-note" role="alert">
              {error}
            </p>
          )}
          {result && (
            <div className="ai-proposal">
              <div className="proposal-head">
                <span className="proposal-fold">
                  <Sparkles size={14} />
                </span>
                <div>
                  <strong>{result.proposal.summary}</strong>
                  <small>
                    {(result.run.inputTokens ?? 0) +
                      (result.run.outputTokens ?? 0)}{" "}
                    gemessene Tokens
                  </small>
                </div>
              </div>
              <div className="diff-list">
                {result.proposal.operations.map((operation) => (
                  <label key={operation.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(operation.id)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, operation.id]
                            : current.filter((id) => id !== operation.id),
                        )
                      }
                    />
                    <span>
                      <i>{operationLabel(operation.type)}</i>
                      <strong>
                        {operation.title ?? operation.taskId ?? "Aufgabe"}
                      </strong>
                      <small>
                        {operation.patch
                          ? JSON.stringify(operation.patch)
                          : "Wird nach Freigabe erstellt"}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
              <footer>
                <button
                  className="secondary-button"
                  disabled={loading}
                  onClick={() => void resolve("reject")}
                >
                  Verwerfen
                </button>
                <button
                  className="primary-button"
                  disabled={loading || selected.length === 0}
                  onClick={() => void resolve("apply")}
                >
                  <Check size={15} /> {selected.length} Änderungen übernehmen
                </button>
              </footer>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function CommandPalette({
  onClose,
  onCreate,
  onNavigate,
  onAssistant,
}: {
  onClose: () => void;
  onCreate: () => void;
  onNavigate: (next: string) => void;
  onAssistant: () => void;
}) {
  const [query, setQuery] = useState("");
  const items = [
    { label: "Neue Aufgabe", hint: "C", icon: <Plus />, action: onCreate },
    {
      label: "Meine Arbeit öffnen",
      hint: "G M",
      icon: <CircleDot />,
      action: () => onNavigate("my-work"),
    },
    {
      label: "Scope Launch öffnen",
      hint: "G P",
      icon: <Grid2X2 />,
      action: () => onNavigate("project"),
    },
    {
      label: "Kalender öffnen",
      hint: "G K",
      icon: <CalendarDays />,
      action: () => onNavigate("calendar"),
    },
    {
      label: "Scope Assist fragen",
      hint: "A",
      icon: <Sparkles />,
      action: onAssistant,
    },
  ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div
      className="modal-layer command-layer"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="command-palette">
        <div className="command-input">
          <Search size={19} />
          <input
            autoFocus
            placeholder="Suchen oder Befehl eingeben …"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-results">
          <small>Aktionen</small>
          {items.map((item) => (
            <button key={item.label} onClick={item.action}>
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
              <kbd>{item.hint}</kbd>
            </button>
          ))}
        </div>
        <footer>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigieren
          </span>
          <span>
            <kbd>↵</kbd> auswählen
          </span>
        </footer>
      </div>
    </div>
  );
}

function SettingsDialog({
  workspaceId,
  account,
  appearance,
  setAppearance,
  accent,
  setAccent,
  density,
  setDensity,
  onClose,
  onSaved,
  onShare,
  onLogout,
}: {
  workspaceId: string;
  account: AccountState;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  accent: string;
  setAccent: (accent: string) => void;
  density: string;
  setDensity: (density: string) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onShare: () => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<"appearance" | "profile" | "ai" | "workspace">(
    "appearance",
  );
  const [name, setName] = useState(account.name);
  const [workspaceName, setWorkspaceName] = useState(account.workspaceName);
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [removeTarget, setRemoveTarget] = useState("");
  const [providerType, setProviderType] = useState("openai");
  const [providerName, setProviderName] = useState("OpenAI");
  const [providerEndpoint, setProviderEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState("");
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [locale, setLocale] = useState<"de" | "en">(account.locale);
  const [message, setMessage] = useState("");
  const canAdmin = account.role === "owner" || account.role === "admin";
  const accents = ["#8CA8FF", "#8FE0B0", "#D3A5FF", "#FFB4AB", "#F0C46E"];
  const loadProviders = async () => {
    const response = await fetch(
      `/api/v1/ai/providers?workspaceId=${workspaceId}`,
      { cache: "no-store" },
    );
    const payload = await response.json();
    if (response.ok) setProviders(payload.data);
  };
  const loadUsage = async () => {
    const response = await fetch(
      `/api/v1/ai/usage?workspaceId=${workspaceId}`,
      { cache: "no-store" },
    );
    const payload = await response.json();
    if (response.ok) setUsage(payload.data);
  };
  const loadMembers = async () => {
    const response = await fetch(`/api/v1/workspaces/${workspaceId}/members`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (response.ok) setMembers(payload.data);
  };
  useEffect(() => {
    if (tab === "ai") {
      void loadProviders();
      void loadUsage();
    }
    if (tab === "workspace") void loadMembers();
  }, [tab]);
  const saveProfile = async () => {
    const response = await fetch("/api/v1/users/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, locale }),
    });
    const payload = await response.json();
    if (!response.ok)
      return setMessage(
        payload.error?.message ?? "Profil konnte nicht gespeichert werden",
      );
    document.documentElement.lang = locale;
    await onSaved();
    setMessage(locale === "de" ? "Profil gespeichert" : "Profile saved");
  };
  const saveWorkspace = async () => {
    const response = await fetch(`/api/v1/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: workspaceName }),
    });
    const payload = await response.json();
    if (!response.ok)
      return setMessage(
        payload.error?.message ?? "Workspace konnte nicht gespeichert werden",
      );
    await onSaved();
    setMessage("Workspace gespeichert");
  };
  const addProvider = async () => {
    setMessage("");
    const response = await fetch("/api/v1/ai/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        provider: providerType,
        name: providerName,
        endpoint: providerEndpoint || undefined,
        apiKey: apiKey || undefined,
      }),
    });
    const payload = await response.json();
    if (!response.ok)
      return setMessage(
        payload.error?.message ?? "Provider konnte nicht gespeichert werden",
      );
    setApiKey("");
    await loadProviders();
    setMessage("Provider gespeichert. Jetzt Modelle abrufen.");
  };
  const testProvider = async (providerId: string) => {
    setMessage("Verbindung und Modelle werden geprüft…");
    const response = await fetch(
      `/api/v1/ai/providers/${providerId}/test?workspaceId=${workspaceId}`,
      { method: "POST" },
    );
    const payload = await response.json();
    if (response.ok) await loadProviders();
    setMessage(
      response.ok
        ? `Verbindung erfolgreich · ${payload.data.models?.length ?? 0} Modelle · ${payload.data.latencyMs} ms`
        : (payload.error?.message ?? "Verbindung fehlgeschlagen"),
    );
  };
  const changeMemberRole = async (memberId: string, role: string) => {
    const response = await fetch(
      `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      },
    );
    const payload = await response.json();
    if (!response.ok)
      return setMessage(
        payload.error?.message ?? "Rolle konnte nicht geändert werden",
      );
    await loadMembers();
    setMessage("Rolle aktualisiert");
  };
  const removeMember = async (memberId: string) => {
    if (removeTarget !== memberId) {
      setRemoveTarget(memberId);
      return;
    }
    const response = await fetch(
      `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
      { method: "DELETE" },
    );
    const payload = await response.json();
    if (!response.ok)
      return setMessage(
        payload.error?.message ?? "Mitglied konnte nicht entfernt werden",
      );
    setRemoveTarget("");
    await loadMembers();
    setMessage("Mitglied entfernt");
  };
  const headings = {
    appearance: ["Darstellung", "So fühlt sich Scope für dich an."],
    profile: ["Profil", "Dein lokales Benutzerkonto."],
    ai: ["KI & Modelle", "Provider bleiben unter deiner Kontrolle."],
    workspace: ["Workspace", "Name, Einladungen und Rolle."],
  } as const;

  return (
    <div className="modal-layer">
      <div className="settings-dialog">
        <aside>
          <div className="brand">
            <ScopeMark size={24} />
            <span>Einstellungen</span>
          </div>
          <button
            className={tab === "appearance" ? "active" : ""}
            onClick={() => setTab("appearance")}
          >
            <Palette /> Darstellung
          </button>
          <button
            className={tab === "profile" ? "active" : ""}
            onClick={() => setTab("profile")}
          >
            <UserRound /> Profil
          </button>
          <button
            className={tab === "ai" ? "active" : ""}
            onClick={() => setTab("ai")}
          >
            <Bot /> KI & Modelle
          </button>
          <button
            className={tab === "workspace" ? "active" : ""}
            onClick={() => setTab("workspace")}
          >
            <Users /> Workspace
          </button>
        </aside>
        <section>
          <header>
            <div>
              <h1>{headings[tab][0]}</h1>
              <p>{headings[tab][1]}</p>
            </div>
            <button className="icon-button" onClick={onClose}>
              <X size={18} />
            </button>
          </header>
          {tab === "appearance" && (
            <>
              <div className="setting-group">
                <label>Erscheinungsbild</label>
                <div className="appearance-options">
                  {(["system", "light", "dark"] as Appearance[]).map(
                    (value) => (
                      <button
                        key={value}
                        className={appearance === value ? "active" : ""}
                        onClick={() => setAppearance(value)}
                      >
                        <span className={`appearance-preview ${value}`}>
                          <i />
                          <b />
                        </span>
                        <strong>
                          {value === "system"
                            ? "System"
                            : value === "light"
                              ? "Hell"
                              : "Dunkel"}
                        </strong>
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div className="setting-row">
                <div>
                  <strong>Akzentfarbe</strong>
                  <small>Für Auswahl, Fokus und wichtige Aktionen.</small>
                </div>
                <div className="accent-options">
                  {accents.map((color) => (
                    <button
                      key={color}
                      aria-label={`Akzent ${color}`}
                      className={accent === color ? "active" : ""}
                      style={{ background: color }}
                      onClick={() => setAccent(color)}
                    >
                      {accent === color && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="setting-row">
                <div>
                  <strong>Dichte</strong>
                  <small>Abstand in Listen und Boards.</small>
                </div>
                <div className="segmented">
                  <button
                    className={density === "compact" ? "active" : ""}
                    onClick={() => setDensity("compact")}
                  >
                    Kompakt
                  </button>
                  <button
                    className={density === "comfortable" ? "active" : ""}
                    onClick={() => setDensity("comfortable")}
                  >
                    Komfortabel
                  </button>
                </div>
              </div>
            </>
          )}
          {tab === "profile" && (
            <>
              <div className="setting-group">
                <div className="field-row">
                  <label>
                    Name
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <label>
                    E-Mail
                    <input value={account.email} readOnly />
                  </label>
                </div>
                <button
                  className="primary-button compact"
                  disabled={name.trim().length < 2}
                  onClick={() => void saveProfile()}
                >
                  Profil speichern
                </button>
              </div>
              <div className="setting-row danger-zone">
                <div>
                  <strong>Abmelden</strong>
                  <small>Beendet nur deine aktuelle Sitzung.</small>
                </div>
                <button className="secondary-button compact" onClick={onLogout}>
                  Abmelden
                </button>
              </div>
            </>
          )}
          {tab === "ai" && (
            <>
              {providers.length > 0 && (
                <div className="setting-group">
                  <label>Konfigurierte Provider</label>
                  {providers.map((provider) => (
                    <div className="setting-row" key={provider.id}>
                      <div>
                        <strong>{provider.name}</strong>
                        <small>
                          {provider.provider} ·{" "}
                          {provider.models.length
                            ? provider.models.join(", ")
                            : "Modell-ID beim Lauf eingeben"}
                        </small>
                      </div>
                      {canAdmin && (
                        <button
                          className="secondary-button compact"
                          onClick={() => void testProvider(provider.id)}
                        >
                          Verbindung testen
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {canAdmin ? (
                <div className="setting-group">
                  <label>Provider hinzufügen</label>
                  <div className="field-row">
                    <label>
                      Typ
                      <select
                        value={providerType}
                        onChange={(event) => {
                          setProviderType(event.target.value);
                          setProviderName(
                            event.target.options[event.target.selectedIndex]
                              .text,
                          );
                        }}
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="gemini">Gemini</option>
                        <option value="openrouter">OpenRouter</option>
                        <option value="ollama">Ollama</option>
                        <option value="compatible">OpenAI-kompatibel</option>
                      </select>
                    </label>
                    <label>
                      Name
                      <input
                        value={providerName}
                        onChange={(event) =>
                          setProviderName(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Endpoint (optional)
                      <input
                        type="url"
                        autoComplete="off"
                        value={providerEndpoint}
                        onChange={(event) =>
                          setProviderEndpoint(event.target.value)
                        }
                        placeholder="https://…/v1"
                      />
                    </label>
                    <label>
                      API-Schlüssel
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                      />
                    </label>
                  </div>
                  <label className="wide-field">
                    Modelle, kommagetrennt
                    <input
                      value={models}
                      onChange={(event) => setModels(event.target.value)}
                      placeholder="gpt-5-mini, gpt-5.1"
                    />
                  </label>
                  <button
                    className="primary-button compact"
                    disabled={
                      !providerName.trim() ||
                      (providerType === "compatible" && !providerEndpoint)
                    }
                    onClick={() => void addProvider()}
                  >
                    Provider speichern
                  </button>
                </div>
              ) : (
                <p className="privacy-note">
                  Nur Owner und Admins können Provider konfigurieren.
                </p>
              )}
            </>
          )}
          {tab === "workspace" && (
            <>
              <div className="setting-group">
                <div className="field-row">
                  <label>
                    Workspace-Name
                    <input
                      value={workspaceName}
                      onChange={(event) => setWorkspaceName(event.target.value)}
                      readOnly={!canAdmin}
                    />
                  </label>
                  <label>
                    Deine Rolle
                    <input value={roleLabel(account.role)} readOnly />
                  </label>
                </div>
                {canAdmin && (
                  <button
                    className="primary-button compact"
                    disabled={workspaceName.trim().length < 2}
                    onClick={() => void saveWorkspace()}
                  >
                    Workspace speichern
                  </button>
                )}
              </div>
              <div className="setting-group">
                <label>Mitglieder</label>
                {members.map((member) => (
                  <div className="setting-row member-setting" key={member.id}>
                    <div>
                      <strong>{member.name}</strong>
                      <small>{member.email}</small>
                    </div>
                    {member.role === "owner" || !canAdmin ? (
                      <span>{roleLabel(member.role)}</span>
                    ) : (
                      <div className="member-actions">
                        <select
                          aria-label={`Rolle für ${member.name}`}
                          value={member.role}
                          onChange={(event) =>
                            void changeMemberRole(member.id, event.target.value)
                          }
                        >
                          <option value="member">Mitglied</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          className="secondary-button compact"
                          onClick={() => void removeMember(member.id)}
                        >
                          {removeTarget === member.id
                            ? "Entfernen bestätigen"
                            : "Entfernen"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {canAdmin && (
                <div className="setting-row">
                  <div>
                    <strong>Mitglied einladen</strong>
                    <small>
                      Erzeugt einen einmaligen, sieben Tage gültigen Link.
                    </small>
                  </div>
                  <button
                    className="secondary-button compact"
                    onClick={onShare}
                  >
                    Einladungslink erstellen
                  </button>
                </div>
              )}
            </>
          )}
          {message && (
            <p className="privacy-note" role="status">
              {message}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

type SettingsProps = {
  workspaceId: string;
  account: AccountState;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  accent: string;
  setAccent: (accent: string) => void;
  density: string;
  setDensity: (density: string) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onShare: () => void;
  onLogout: () => void;
};

function SettingsDialogV2({
  workspaceId,
  account,
  appearance,
  setAppearance,
  accent,
  setAccent,
  density,
  setDensity,
  onClose,
  onSaved,
  onShare,
  onLogout,
}: SettingsProps) {
  const [tab, setTab] = useState<"appearance" | "profile" | "ai" | "workspace">(
    "appearance",
  );
  const [name, setName] = useState(account.name);
  const [locale, setLocale] = useState<"de" | "en">(account.locale);
  const [workspaceName, setWorkspaceName] = useState(account.workspaceName);
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [removeTarget, setRemoveTarget] = useState("");
  const [providerType, setProviderType] = useState("openai");
  const [providerName, setProviderName] = useState("OpenAI");
  const [providerEndpoint, setProviderEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const canAdmin = account.role === "owner" || account.role === "admin";
  const accents = ["#8CA8FF", "#8FE0B0", "#D3A5FF", "#FFB4AB", "#F0C46E"];
  const loadProviders = async () => {
    const response = await fetch(
      `/api/v1/ai/providers?workspaceId=${workspaceId}`,
      { cache: "no-store" },
    );
    const payload = await response.json();
    if (response.ok) setProviders(payload.data);
  };
  const loadUsage = async () => {
    const response = await fetch(
      `/api/v1/ai/usage?workspaceId=${workspaceId}`,
      { cache: "no-store" },
    );
    const payload = await response.json();
    if (response.ok) setUsage(payload.data);
  };
  const loadMembers = async () => {
    const response = await fetch(`/api/v1/workspaces/${workspaceId}/members`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (response.ok) setMembers(payload.data);
  };
  useEffect(() => {
    if (tab === "ai") {
      void loadProviders();
      void loadUsage();
    }
    if (tab === "workspace") void loadMembers();
  }, [tab]);
  const saveProfile = async () => {
    const response = await fetch("/api/v1/users/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, locale }),
    });
    const payload = await response.json();
    if (!response.ok)
      return setMessage(
        payload.error?.message ?? "Profil konnte nicht gespeichert werden",
      );
    document.documentElement.lang = locale;
    await onSaved();
    setMessage(locale === "de" ? "Profil gespeichert" : "Profile saved");
  };
  const saveWorkspace = async () => {
    const response = await fetch(`/api/v1/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: workspaceName }),
    });
    const payload = await response.json();
    if (!response.ok)
      return setMessage(
        payload.error?.message ?? "Workspace konnte nicht gespeichert werden",
      );
    await onSaved();
    setMessage("Workspace gespeichert");
  };
  const addProvider = async () => {
    setMessage("");
    const response = await fetch("/api/v1/ai/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        provider: providerType,
        name: providerName,
        endpoint: providerEndpoint || undefined,
        apiKey: apiKey || undefined,
      }),
    });
    const payload = await response.json();
    if (!response.ok)
      return setMessage(
        payload.error?.message ?? "Provider konnte nicht gespeichert werden",
      );
    setApiKey("");
    await loadProviders();
    setMessage("Provider gespeichert. Rufe jetzt die verfügbaren Modelle ab.");
  };
  const testProvider = async (providerId: string) => {
    setMessage("Verbindung und Modelle werden geprüft…");
    const response = await fetch(
      `/api/v1/ai/providers/${providerId}/test?workspaceId=${workspaceId}`,
      { method: "POST" },
    );
    const payload = await response.json();
    if (response.ok) await loadProviders();
    setMessage(
      response.ok
        ? `Verbunden · ${payload.data.models?.length ?? 0} Modelle · ${payload.data.latencyMs} ms`
        : (payload.error?.message ?? "Verbindung fehlgeschlagen"),
    );
  };
  const changeMemberRole = async (memberId: string, role: string) => {
    const response = await fetch(
      `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      },
    );
    const payload = await response.json();
    if (!response.ok)
      return setMessage(
        payload.error?.message ?? "Rolle konnte nicht geändert werden",
      );
    await loadMembers();
  };
  const removeMember = async (memberId: string) => {
    if (removeTarget !== memberId) return setRemoveTarget(memberId);
    const response = await fetch(
      `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
      { method: "DELETE" },
    );
    const payload = await response.json();
    if (!response.ok)
      return setMessage(
        payload.error?.message ?? "Mitglied konnte nicht entfernt werden",
      );
    setRemoveTarget("");
    await loadMembers();
  };
  const headings = {
    appearance: ["Darstellung", "So fühlt sich Scope für dich an."],
    profile: ["Profil & Sprache", "Dein lokales Benutzerkonto."],
    ai: ["KI & Modelle", "Modelle, Nutzung und Provider im Überblick."],
    workspace: ["Workspace", "Name, Einladungen und Rollen."],
  } as const;
  return (
    <div className="modal-layer">
      <div className="settings-dialog">
        <aside>
          <div className="brand">
            <ScopeMark size={24} />
            <span>Einstellungen</span>
          </div>
          <button
            className={tab === "appearance" ? "active" : ""}
            onClick={() => setTab("appearance")}
          >
            <Palette /> Darstellung
          </button>
          <button
            className={tab === "profile" ? "active" : ""}
            onClick={() => setTab("profile")}
          >
            <UserRound /> Profil
          </button>
          <button
            className={tab === "ai" ? "active" : ""}
            onClick={() => setTab("ai")}
          >
            <Bot /> KI & Modelle
          </button>
          <button
            className={tab === "workspace" ? "active" : ""}
            onClick={() => setTab("workspace")}
          >
            <Users /> Workspace
          </button>
        </aside>
        <section>
          <header>
            <div>
              <h1>{headings[tab][0]}</h1>
              <p>{headings[tab][1]}</p>
            </div>
            <button
              className="icon-button"
              aria-label="Schließen"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </header>
          {tab === "appearance" && (
            <>
              <div className="setting-group">
                <label>Erscheinungsbild</label>
                <div className="appearance-options">
                  {(["system", "light", "dark"] as Appearance[]).map(
                    (value) => (
                      <button
                        key={value}
                        className={appearance === value ? "active" : ""}
                        onClick={() => setAppearance(value)}
                      >
                        <span className={`appearance-preview ${value}`}>
                          <i />
                          <b />
                        </span>
                        <strong>
                          {value === "system"
                            ? "System"
                            : value === "light"
                              ? "Hell"
                              : "Dunkel"}
                        </strong>
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div className="setting-row">
                <div>
                  <strong>Akzentfarbe</strong>
                  <small>Für Auswahl, Fokus und wichtige Aktionen.</small>
                </div>
                <div className="accent-options">
                  {accents.map((color) => (
                    <button
                      key={color}
                      aria-label={`Akzent ${color}`}
                      className={accent === color ? "active" : ""}
                      style={{ background: color }}
                      onClick={() => setAccent(color)}
                    >
                      {accent === color && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="setting-row">
                <div>
                  <strong>Dichte</strong>
                  <small>Abstand in Listen und Boards.</small>
                </div>
                <div className="segmented">
                  <button
                    className={density === "compact" ? "active" : ""}
                    onClick={() => setDensity("compact")}
                  >
                    Kompakt
                  </button>
                  <button
                    className={density === "comfortable" ? "active" : ""}
                    onClick={() => setDensity("comfortable")}
                  >
                    Komfortabel
                  </button>
                </div>
              </div>
            </>
          )}
          {tab === "profile" && (
            <>
              <div className="setting-group">
                <div className="field-row">
                  <label>
                    Name
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <label>
                    E-Mail
                    <input value={account.email} readOnly />
                  </label>
                  <label>
                    Sprache
                    <select
                      value={locale}
                      onChange={(event) =>
                        setLocale(event.target.value as "de" | "en")
                      }
                    >
                      <option value="de">Deutsch</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                </div>
                <p className="privacy-note">
                  Sprachpakete sind zentral registriert und können später von
                  der Community ergänzt werden.
                </p>
                <button
                  className="primary-button compact"
                  disabled={name.trim().length < 2}
                  onClick={() => void saveProfile()}
                >
                  Profil speichern
                </button>
              </div>
              <div className="setting-row danger-zone">
                <div>
                  <strong>Abmelden</strong>
                  <small>Beendet nur deine aktuelle Sitzung.</small>
                </div>
                <button className="secondary-button compact" onClick={onLogout}>
                  Abmelden
                </button>
              </div>
            </>
          )}
          {tab === "ai" && (
            <>
              <div className="usage-grid">
                <article>
                  <BarChart3 />
                  <span>
                    <strong>
                      {usage?.month.tokens.toLocaleString("de-DE") ?? "–"}
                    </strong>
                    <small>Tokens diesen Monat</small>
                  </span>
                </article>
                <article>
                  <Sparkles />
                  <span>
                    <strong>{usage?.month.runs ?? "–"}</strong>
                    <small>Läufe diesen Monat</small>
                  </span>
                </article>
                <article>
                  <Clock3 />
                  <span>
                    <strong>
                      {usage?.total.tokens.toLocaleString("de-DE") ?? "–"}
                    </strong>
                    <small>Tokens insgesamt</small>
                  </span>
                </article>
              </div>
              {providers.length > 0 && (
                <div className="setting-group">
                  <label>Konfigurierte Provider</label>
                  {providers.map((provider) => (
                    <div className="setting-row" key={provider.id}>
                      <div>
                        <strong>{provider.name}</strong>
                        <small>
                          {provider.provider} ·{" "}
                          {provider.models.length
                            ? `${provider.models.length} Modelle verfügbar`
                            : "Modelle noch nicht abgerufen"}
                        </small>
                      </div>
                      {canAdmin && (
                        <button
                          className="secondary-button compact"
                          onClick={() => void testProvider(provider.id)}
                        >
                          Modelle aktualisieren
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {canAdmin ? (
                <div className="setting-group">
                  <label>Provider hinzufügen</label>
                  <div className="field-row">
                    <label>
                      Typ
                      <select
                        value={providerType}
                        onChange={(event) => {
                          setProviderType(event.target.value);
                          setProviderName(
                            event.target.options[event.target.selectedIndex]
                              .text,
                          );
                        }}
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="gemini">Gemini</option>
                        <option value="openrouter">OpenRouter</option>
                        <option value="ollama">Ollama</option>
                        <option value="compatible">OpenAI-kompatibel</option>
                      </select>
                    </label>
                    <label>
                      Name
                      <input
                        value={providerName}
                        onChange={(event) =>
                          setProviderName(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Endpoint (optional)
                      <input
                        type="url"
                        autoComplete="off"
                        value={providerEndpoint}
                        onChange={(event) =>
                          setProviderEndpoint(event.target.value)
                        }
                        placeholder="https://…/v1"
                      />
                    </label>
                    <label>
                      API-Schlüssel
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                      />
                    </label>
                  </div>
                  <button
                    className="primary-button compact"
                    disabled={
                      !providerName.trim() ||
                      (providerType === "compatible" && !providerEndpoint)
                    }
                    onClick={() => void addProvider()}
                  >
                    Provider speichern
                  </button>
                </div>
              ) : (
                <p className="privacy-note">
                  Nur Owner und Admins können Provider konfigurieren.
                </p>
              )}
            </>
          )}
          {tab === "workspace" && (
            <>
              <div className="setting-group">
                <div className="field-row">
                  <label>
                    Workspace-Name
                    <input
                      value={workspaceName}
                      onChange={(event) => setWorkspaceName(event.target.value)}
                      readOnly={!canAdmin}
                    />
                  </label>
                  <label>
                    Deine Rolle
                    <input value={roleLabel(account.role)} readOnly />
                  </label>
                </div>
                {canAdmin && (
                  <button
                    className="primary-button compact"
                    disabled={workspaceName.trim().length < 2}
                    onClick={() => void saveWorkspace()}
                  >
                    Workspace speichern
                  </button>
                )}
              </div>
              <div className="setting-group">
                <label>Mitglieder</label>
                {members.map((member) => (
                  <div className="setting-row member-setting" key={member.id}>
                    <div>
                      <strong>{member.name}</strong>
                      <small>{member.email}</small>
                    </div>
                    {member.role === "owner" || !canAdmin ? (
                      <span>{roleLabel(member.role)}</span>
                    ) : (
                      <div className="member-actions">
                        <select
                          aria-label={`Rolle für ${member.name}`}
                          value={member.role}
                          onChange={(event) =>
                            void changeMemberRole(member.id, event.target.value)
                          }
                        >
                          <option value="member">Mitglied</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          className="secondary-button compact"
                          onClick={() => void removeMember(member.id)}
                        >
                          {removeTarget === member.id
                            ? "Entfernen bestätigen"
                            : "Entfernen"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {canAdmin && (
                <div className="setting-row">
                  <div>
                    <strong>Mitglied einladen</strong>
                    <small>
                      Erzeugt einen einmaligen, sieben Tage gültigen Link.
                    </small>
                  </div>
                  <button
                    className="secondary-button compact"
                    onClick={onShare}
                  >
                    Einladungslink erstellen
                  </button>
                </div>
              )}
            </>
          )}
          {message && (
            <p className="privacy-note" role="status">
              {message}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function localDate(offset = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return value.toLocaleDateString("sv-SE");
}
function isDue(date: string) {
  return Boolean(date) && date <= localDate();
}
function formatDue(date: string) {
  if (!date) return "Kein Datum";
  if (date === localDate()) return "Heute";
  if (date === localDate(1)) return "Morgen";
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? "Kein Datum"
    : new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "short",
      }).format(parsed);
}
function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return (
    element?.tagName === "INPUT" ||
    element?.tagName === "TEXTAREA" ||
    element?.tagName === "SELECT" ||
    element?.isContentEditable
  );
}
function roleLabel(role: string) {
  return role === "owner"
    ? "Workspace Owner"
    : role === "admin"
      ? "Workspace Admin"
      : "Mitglied";
}
function operationLabel(type: ProposalOperation["type"]) {
  return type === "task.update"
    ? "Aufgabe ändern"
    : type === "task.create"
      ? "Aufgabe erstellen"
      : type === "subtask.create"
        ? "Unteraufgabe erstellen"
        : type === "milestone.create"
          ? "Meilenstein erstellen"
          : "Abhängigkeit erstellen";
}
function activityLabel(action: string) {
  return action === "task.created"
    ? " hat die Aufgabe erstellt."
    : action === "task.updated"
      ? " hat die Aufgabe geändert."
      : action === "activity.undone"
        ? " hat eine Änderung rückgängig gemacht."
        : ` · ${action}`;
}
