import { useCallback, useEffect, useRef, useState } from 'react';

// Loads data when a page opens. Returns { data, error, loading, reload, setData }.
//   const { data, error, loading, reload } = useLoad(() => api.get('/courses'), []);
export function useLoad(load, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const latest = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    const request = ++latest.current;
    try {
      const data = await load();
      // Ignore the answer if a newer request has started since.
      if (request === latest.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (request === latest.current) setState((old) => ({ ...old, error, loading: false }));
    }
  }, deps);

  useEffect(() => {
    setState((old) => ({ ...old, loading: true }));
    reload();
  }, [reload]);

  return { ...state, reload };
}
