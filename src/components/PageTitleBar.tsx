import { IonButton, IonIcon } from '@ionic/react';
import { icons } from '../icons';
import './PageTitleBar.css';

interface PageTitleBarProps {
  title: string;
  /** Accessible label for the green "+" button */
  addLabel: string;
  onAdd: () => void;
}

/** Large page title with the round "+" action, as in the Manifiestos/Remesas designs. */
const PageTitleBar: React.FC<PageTitleBarProps> = ({ title, addLabel, onAdd }) => (
  <div className="flex items-center justify-between">
    <h1 className="m-0 text-[31px] leading-9 font-semibold tracking-[-1px] text-tinta">{title}</h1>
    <IonButton className="page-title-add" aria-label={addLabel} onClick={onAdd}>
      <IonIcon slot="icon-only" icon={icons.plus} />
    </IonButton>
  </div>
);

export default PageTitleBar;
