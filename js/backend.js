(() => {
  const cfg = window.FRONTIER_CONFIG || {};
  const hasSupabase = !!(
    window.supabase &&
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !String(cfg.SUPABASE_URL).includes("COLE_AQUI") &&
    !String(cfg.SUPABASE_ANON_KEY).includes("COLE_AQUI")
  );

  const client = hasSupabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const LOCAL_ACCOUNTS_KEY = "frontier_local_accounts_v1";
  const LOCAL_SESSION_KEY = "frontier_local_session_v1";

  function encodeEmail(email) {
    return btoa(unescape(encodeURIComponent(email.toLowerCase()))).replace(/=/g, "");
  }
  function dataKey(email) {
    return "frontier_data_v5_" + encodeEmail(email);
  }
  function blankState() {
    return { projects: [], finance: [], accounts: [], notes: [], noteFolders: [], pets: [], calendar: [], vehicles: [], studySessions: [], books: [], habits: [], habitLogs: [], notifications: [] };
  }
  function localAccounts() {
    try { return JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_KEY) || "{}"); } catch { return {}; }
  }
  function saveLocalAccounts(a) { localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(a)); }

  const api = {
    mode: hasSupabase ? "supabase" : "local",
    client,
    blankState,

    async register({name,email,password}) {
      email = email.trim().toLowerCase();
      if (hasSupabase) {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: { display_name: name } }
        });
        if (error) throw error;
        return { user: data.user, session: data.session, needsConfirmation: !data.session };
      }
      const accounts = localAccounts();
      if (accounts[email]) throw new Error("Já existe uma conta local com este e-mail.");
      accounts[email] = { name, password, preferences: { display_name: name, week_start: "sunday", theme: "dark", default_page: "dashboard" } };
      saveLocalAccounts(accounts);
      localStorage.setItem(dataKey(email), JSON.stringify(blankState()));
      localStorage.setItem(LOCAL_SESSION_KEY, email);
      return { user: { id: encodeEmail(email), email, user_metadata: { display_name: name } }, session: { local: true } };
    },

    async login({email,password}) {
      email = email.trim().toLowerCase();
      if (hasSupabase) {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
      }
      const accounts = localAccounts();
      const a = accounts[email];
      if (!a || a.password !== password) throw new Error("E-mail ou senha inválidos.");
      localStorage.setItem(LOCAL_SESSION_KEY, email);
      return { user: { id: encodeEmail(email), email, user_metadata: { display_name: a.name, ...(a.preferences || {}) } }, session: { local: true } };
    },

    async logout() {
      if (hasSupabase) {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      } else localStorage.removeItem(LOCAL_SESSION_KEY);
    },

    async resetPassword(email) {
      if (!hasSupabase) throw new Error("Recuperação por e-mail fica disponível quando o Supabase estiver configurado.");
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] });
      if (error) throw error;
    },

    async updatePassword(password) {
      if (!hasSupabase) throw new Error("Atualização de senha exige Supabase.");
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
    },


    async updatePreferences(preferences) {
      if (hasSupabase) {
        const { data, error } = await client.auth.updateUser({ data: preferences });
        if (error) throw error;
        return data.user;
      }
      const email = localStorage.getItem(LOCAL_SESSION_KEY);
      if (!email) throw new Error("Sessão local não encontrada.");
      const accounts = localAccounts();
      const account = accounts[email];
      if (!account) throw new Error("Conta local não encontrada.");
      account.preferences = { ...(account.preferences || {}), ...preferences };
      if (preferences.display_name) account.name = preferences.display_name;
      accounts[email] = account;
      saveLocalAccounts(accounts);
      return { id: encodeEmail(email), email, user_metadata: { display_name: account.name, ...(account.preferences || {}) } };
    },

    async getCurrentUser() {
      if (hasSupabase) {
        const { data: { session }, error } = await client.auth.getSession();
        if (error) throw error;
        return session?.user || null;
      }
      const email = localStorage.getItem(LOCAL_SESSION_KEY);
      if (!email) return null;
      const a = localAccounts()[email];
      if (!a) return null;
      return { id: encodeEmail(email), email, user_metadata: { display_name: a.name, ...(a.preferences || {}) } };
    },

    async loadState(user) {
      if (!user) return blankState();
      if (!hasSupabase) {
        try {
          return { ...blankState(), ...JSON.parse(localStorage.getItem(dataKey(user.email)) || "{}") };
        } catch { return blankState(); }
      }
      const tables = [
        ["projects","projects"], ["finance_entries","finance"], ["accounts","accounts"],
        ["notes","notes"], ["note_folders","noteFolders"], ["pets","pets"], ["calendar_events","calendar"],
        ["vehicles","vehicles"], ["study_sessions","studySessions"], ["books","books"],
        ["habits","habits"], ["habit_logs","habitLogs"], ["notifications","notifications"]
      ];
      const result = blankState();
      for (const [table,key] of tables) {
        const { data, error } = await client.from(table).select("*").order("created_at", { ascending: false });
        if (error) {
          const optional = ["habits","habit_logs","notifications"].includes(table);
          if (optional && (error.code === "42P01" || String(error.message || "").toLowerCase().includes("does not exist"))) continue;
          throw error;
        }
        result[key] = (data || []).map(row => row.payload ? { ...row.payload, id: row.id } : row);
      }
      return result;
    },

    async saveState(user,state) {
      if (!user) return;
      if (!hasSupabase) {
        localStorage.setItem(dataKey(user.email), JSON.stringify(state));
      }
    },

    async upsertEntity(user, table, entity) {
      if (!hasSupabase) return entity;
      const payload = { id: entity.id, user_id: user.id, payload: entity, updated_at: new Date().toISOString() };
      const { error } = await client.from(table).upsert(payload);
      if (error) throw error;
      return entity;
    },

    async deleteEntity(user, table, id) {
      if (!hasSupabase) return;
      const { error } = await client.from(table).delete().eq("id", id);
      if (error) throw error;
    },

    async savePushSubscription(user, subscription) {
      if (!hasSupabase) throw new Error("Notificações push exigem Supabase.");
      const json = typeof subscription?.toJSON === "function" ? subscription.toJSON() : subscription;
      if (!json?.endpoint) throw new Error("Assinatura de notificações inválida.");
      const row = { user_id: user.id, endpoint: json.endpoint, subscription: json, enabled: true, updated_at: new Date().toISOString() };
      const { error } = await client.from("push_subscriptions").upsert(row, { onConflict: "endpoint" });
      if (error) throw error;
      return row;
    },

    async removePushSubscription(user, endpoint) {
      if (!hasSupabase || !endpoint) return;
      const { error } = await client.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
      if (error) throw error;
    },

    onAuthStateChange(callback) {
      if (!hasSupabase) return { data: { subscription: { unsubscribe(){} } } };
      return client.auth.onAuthStateChange((event, session) => callback(event, session?.user || null));
    }
  };

  window.FrontierBackend = api;
})();