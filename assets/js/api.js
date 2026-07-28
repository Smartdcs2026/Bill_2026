(function(){
  'use strict';

  const cfg = window.APP_CONFIG || {};
  const TOKEN_KEY = 'csi_session_token';
  const USER_KEY = 'csi_user';
  const VERIFIED_AT_KEY = 'csi_session_verified_at';

  const REQUEST_TIMEOUT_MS = 15000;
  const SESSION_VERIFY_TIMEOUT_MS = 10000;
  const SESSION_CACHE_MS = 60000;

  let verifyPromise = null;

  function sessionToken(){
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function cachedUser(){
    try{
      const value = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      return value && typeof value === 'object' ? value : null;
    }catch(_){
      return null;
    }
  }

  function normalizedUser(value){
    if(!value || typeof value !== 'object') return null;

    const roleCode =
      value.role_code ||
      value.roleCode ||
      value.role ||
      '';

    return {
      ...value,
      role_code: roleCode,
      roleCode
    };
  }

  function saveCachedUser(value){
    const user = normalizedUser(value);
    if(user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }

  function clearSession(){
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(VERIFIED_AT_KEY);
  }

  function markVerified(){
    localStorage.setItem(VERIFIED_AT_KEY, String(Date.now()));
  }

  function recentlyVerified(){
    const value = Number(localStorage.getItem(VERIFIED_AT_KEY) || 0);
    return value > 0 && Date.now() - value < SESSION_CACHE_MS;
  }

  function makeError(message, code, status, details){
    const error = new Error(message);
    error.code = code || 'REQUEST_FAILED';
    error.status = Number(status || 0);
    if(details !== undefined) error.details = details;
    return error;
  }

  function isAuthError(error){
    return Boolean(
      error &&
      (
        error.status === 401 ||
        error.code === 'SESSION_EXPIRED' ||
        error.code === 'SESSION_REVOKED' ||
        error.code === 'UNAUTHORIZED' ||
        error.code === 'UNAUTHORIZED_ADMIN'
      )
    );
  }

  function isNetworkError(error){
    return Boolean(
      error &&
      (
        error.code === 'NETWORK_ERROR' ||
        error.code === 'REQUEST_TIMEOUT' ||
        error.name === 'AbortError'
      )
    );
  }

  async function fetchJson(path, options = {}, timeoutMs = REQUEST_TIMEOUT_MS){
    if(!cfg.API_BASE_URL){
      throw makeError(
        'ยังไม่ได้กำหนดที่อยู่ระบบ กรุณาแจ้งผู้ดูแลระบบ',
        'API_CONFIG_MISSING'
      );
    }

    const headers = new Headers(options.headers || {});
    const token = sessionToken();

    if(options.body && !headers.has('Content-Type')){
      headers.set('Content-Type', 'application/json');
    }
    if(token && !headers.has('Authorization')){
      headers.set('Authorization', `Bearer ${token}`);
    }

    const controller = new AbortController();
    const externalSignal = options.signal;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    if(externalSignal){
      if(externalSignal.aborted){
        controller.abort();
      }else{
        externalSignal.addEventListener(
          'abort',
          () => controller.abort(),
          { once: true }
        );
      }
    }

    let response;
    try{
      response = await fetch(`${cfg.API_BASE_URL}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
        cache: 'no-store'
      });
    }catch(error){
      if(error && error.name === 'AbortError'){
        throw makeError(
          'ระบบใช้เวลาตอบกลับนานเกินไป กรุณาลองอีกครั้ง',
          'REQUEST_TIMEOUT'
        );
      }
      throw makeError(
        'ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบอินเทอร์เน็ต',
        'NETWORK_ERROR'
      );
    }finally{
      clearTimeout(timeout);
    }

    const data = await response.json().catch(() => ({
      ok: false,
      error: 'INVALID_JSON',
      message: 'ระบบตอบกลับไม่ถูกต้อง'
    }));

    if(!response.ok || data.ok === false){
      throw makeError(
        data.message || data.error || `HTTP_${response.status}`,
        data.error || `HTTP_${response.status}`,
        response.status,
        data
      );
    }

    return data;
  }

  async function verifySession(options = {}){
    const token = sessionToken();
    if(!token){
      throw makeError(
        'กรุณาเข้าสู่ระบบ',
        'SESSION_EXPIRED',
        401
      );
    }

    if(!options.force && recentlyVerified()){
      const user = normalizedUser(cachedUser());
      if(user) return { ok: true, user, cached: true };
    }

    if(verifyPromise) return verifyPromise;

    verifyPromise = (async () => {
      try{
        const result = await fetchJson(
          '/api/staff/me',
          { method: 'GET' },
          SESSION_VERIFY_TIMEOUT_MS
        );

        if(result && result.user){
          result.user = saveCachedUser(result.user);
        }
        markVerified();
        return result;
      }catch(error){
        if(isAuthError(error)){
          /*
           * ยืนยันซ้ำอีกหนึ่งครั้งก่อนล้าง Session
           * ป้องกัน 401 ชั่วคราวจาก Worker หรือ Edge
           */
          await new Promise(resolve => setTimeout(resolve, 450));

          try{
            const second = await fetchJson(
              '/api/staff/me',
              { method: 'GET' },
              SESSION_VERIFY_TIMEOUT_MS
            );

            if(second && second.user){
              second.user = saveCachedUser(second.user);
            }
            markVerified();
            return second;
          }catch(secondError){
            if(isAuthError(secondError)){
              clearSession();
              throw makeError(
                'ข้อมูลการเข้าสู่ระบบหมดอายุหรือถูกยกเลิก กรุณาเข้าสู่ระบบใหม่',
                'SESSION_EXPIRED',
                401
              );
            }

            /*
             * รอบยืนยันครั้งที่สองเชื่อมต่อไม่ได้:
             * ใช้ข้อมูลผู้ใช้เดิมชั่วคราวและห้ามลบ Token
             */
            const user = normalizedUser(cachedUser());
            if(user && isNetworkError(secondError)){
              return {
                ok: true,
                user,
                cached: true,
                connectionWarning: true
              };
            }
            throw secondError;
          }
        }

        /*
         * อินเทอร์เน็ตขาดหรือ Worker ตอบช้า:
         * ไม่ลบ Session และอนุญาตให้เปลี่ยนหน้าโดยใช้ข้อมูลเดิม
         */
        const user = normalizedUser(cachedUser());
        if(user && isNetworkError(error)){
          return {
            ok: true,
            user,
            cached: true,
            connectionWarning: true
          };
        }

        throw error;
      }finally{
        verifyPromise = null;
      }
    })();

    return verifyPromise;
  }

  async function request(path, options = {}){
    const isLogin =
      path === '/api/staff/login' ||
      path === '/api/bootstrap/admin';

    const isMe = path === '/api/staff/me';
    const token = sessionToken();

    /*
     * ลดการเรียก /staff/me ซ้ำทุกครั้งที่สลับหน้า
     * ภายใน 60 วินาทีใช้ Session ที่เพิ่งตรวจแล้วได้ทันที
     */
    if(isMe && token && recentlyVerified()){
      const user = normalizedUser(cachedUser());
      if(user) return { ok: true, user, cached: true };
    }

    try{
      const result = await fetchJson(path, options);

      if(isMe && result && result.user){
        result.user = saveCachedUser(result.user);
        markVerified();
      }

      return result;
    }catch(error){
      if(isLogin || !token || !isAuthError(error)){
        throw error;
      }

      /*
       * API งานตอบ 401:
       * อย่าเพิ่งลบ Session ให้ตรวจ /staff/me ก่อน
       */
      if(!isMe){
        const verified = await verifySession({ force: true });

        /*
         * Session ยังใช้ได้ แสดงว่า 401 มาจากสิทธิ์ของ Endpoint
         * ไม่ควรลบ Token และไม่ควรบังคับ Login ใหม่
         */
        if(verified && verified.user){
          throw makeError(
            error.message || 'ไม่มีสิทธิ์ดำเนินการส่วนนี้',
            error.code || 'FORBIDDEN',
            error.status || 403,
            error.details
          );
        }
      }

      /*
       * /staff/me จะมาถึงจุดนี้เฉพาะเมื่อยังยืนยันไม่ได้
       */
      return verifySession({ force: true });
    }
  }

  function saveSession(data){
    if(!data || !data.sessionToken){
      throw makeError(
        'ระบบไม่ได้ส่งข้อมูลการเข้าสู่ระบบกลับมา',
        'SESSION_TOKEN_MISSING'
      );
    }

    localStorage.setItem(TOKEN_KEY, data.sessionToken);
    saveCachedUser(data.user || {});
    markVerified();
  }

  function user(){
    return normalizedUser(cachedUser());
  }

  async function logout(){
    try{
      if(sessionToken()){
        await fetchJson(
          '/api/staff/logout',
          { method: 'POST' },
          7000
        );
      }
    }catch(_){
      /* ออกจากระบบในเครื่องต่อ แม้ Server ติดต่อไม่ได้ */
    }finally{
      clearSession();
    }
  }

  window.Api = {
    request,
    saveSession,
    user,
    logout,
    verifySession,
    clearSession,
    isAuthError,
    isNetworkError
  };
})();
