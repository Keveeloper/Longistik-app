import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  type RefresherEventDetail,
} from '@ionic/react';
import logo from '../../assets/logo-longistik.png';
import { icons } from '../../icons';
import { companiesService, matchesCompany, type Company } from '../../services/companies.service';
import { useCompanyStore } from '../../store/company.store';
import './CompanySelect.css';

/** First screen: the user picks the company they work for, then logs in to that company's Longistik. */
const CompanySelect: React.FC = () => {
  const setCompany = useCompanyStore((s) => s.setCompany);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setError(null);
    try {
      setCompanies(await companiesService.list({ force }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setLoading(true);
    load(true);
  };

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await load(true);
    e.detail.complete();
  };

  // The whole directory is small and cached, so search filters locally (accent and case insensitive)
  const results = useMemo(() => companies.filter((c) => matchesCompany(c, query)), [companies, query]);

  return (
    <IonPage>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="flex min-h-full flex-col px-6 pt-[max(74px,calc(var(--ion-safe-area-top)+24px))] pb-[max(32px,calc(var(--ion-safe-area-bottom)+12px))]">
          <img src={logo} alt="Longistik" className="h-[30px] w-auto self-start" />

          <h1 className="mt-[60px] mb-0 text-[31px] leading-[38px] font-semibold text-tinta">
            ¿Para qué empresa trabajas?
          </h1>
          <p className="mt-3 mb-0 text-body text-muted">Elige tu transportadora para ingresar a su Longistik.</p>

          <label className="mt-[36px] block">
            <span className="block text-caption font-medium text-muted">Buscar empresa</span>
            <IonInput
              className="company-search"
              aria-label="Buscar empresa"
              type="search"
              placeholder="Nombre o código"
              autocapitalize="off"
              clearInput
              value={query}
              onIonInput={(e) => setQuery(e.detail.value ?? '')}
            >
              <IonIcon slot="start" icon={icons.search} aria-hidden="true" />
            </IonInput>
          </label>

          <div className="mt-6 flex-1">
            {loading ? (
              <div className="flex justify-center py-10">
                <IonSpinner name="crescent" aria-label="Cargando empresas" />
              </div>
            ) : error ? (
              <div role="alert" className="flex flex-col items-center py-8 text-center">
                <IonIcon icon={icons.wifiOff} className="text-[32px] text-muted" aria-hidden="true" />
                <p className="mt-3 mb-0 text-body text-tinta">{error}</p>
                <p className="mt-1 mb-0 text-caption text-muted">Revisa tu conexión e inténtalo de nuevo.</p>
                <IonButton
                  color="light"
                  onClick={retry}
                  className="company-button mt-5 h-12 text-base font-semibold tracking-normal normal-case"
                >
                  <IonIcon slot="start" icon={icons.refresh} />
                  Reintentar
                </IonButton>
              </div>
            ) : results.length === 0 ? (
              <p className="py-8 text-center text-body text-muted">
                {query ? `No encontramos empresas para «${query.trim()}».` : 'No hay empresas disponibles por ahora.'}
              </p>
            ) : (
              <IonList lines="none" className="company-list">
                {results.map((company) => (
                  // Saving the choice is enough: the route guard takes the user to /login
                  <IonItem key={company.code} button detail={false} className="company-row" onClick={() => setCompany(company)}>
                    <span
                      slot="start"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-tinta"
                      aria-hidden="true"
                    >
                      <IonIcon icon={icons.building} className="text-[22px]" />
                    </span>
                    <IonLabel>
                      <span className="block">{company.name}</span>
                      <span className="company-code block">{company.code}</span>
                    </IonLabel>
                    <IonIcon slot="end" icon={icons.chevronRight} className="company-chevron" aria-hidden="true" />
                  </IonItem>
                ))}
              </IonList>
            )}
          </div>

          <p className="mx-auto mt-6 mb-0 max-w-[320px] text-center text-xs leading-4 text-muted">
            ¿No ves tu empresa? Pide acceso al administrador de tu transportadora.
          </p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default CompanySelect;
