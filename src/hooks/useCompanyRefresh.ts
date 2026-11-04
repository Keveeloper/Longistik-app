import { useEffect } from 'react';
import { companiesService } from '../services/companies.service';
import { useCompanyStore } from '../store/company.store';

/**
 * On every launch, refresh the directory in the background:
 * - the saved company is no longer listed (suspended) -> close the session and go back to the selector;
 * - its data changed (e.g. a new `apiUrl`) -> keep the stored copy up to date.
 * Network errors are ignored so the app keeps working offline with the saved choice.
 */
export const useCompanyRefresh = () => {
  useEffect(() => {
    const saved = useCompanyStore.getState().company;
    if (!saved) return;
    companiesService
      .list({ force: true })
      .then((companies) => {
        // The user may have changed company while the request was in flight
        const { company, setCompany, clearCompany } = useCompanyStore.getState();
        if (company?.code !== saved.code) return;
        const fresh = companies.find((c) => c.code === saved.code);
        if (!fresh) clearCompany();
        else if (JSON.stringify(fresh) !== JSON.stringify(company)) setCompany(fresh);
      })
      .catch(() => {});
  }, []);
};
