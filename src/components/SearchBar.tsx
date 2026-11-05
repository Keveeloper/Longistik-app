import { IonSearchbar } from '@ionic/react';
import { icons } from '../icons';
import './SearchBar.css';

interface SearchBarProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Pill search field on superficie (IonSearchbar styled to the designs). */
const SearchBar: React.FC<SearchBarProps> = ({ placeholder, value, onChange, className = '' }) => (
  <IonSearchbar
    className={`app-search ${className}`}
    placeholder={placeholder}
    searchIcon={icons.search}
    showClearButton="focus"
    value={value}
    onIonInput={(e) => onChange(e.detail.value ?? '')}
    debounce={150}
  />
);

export default SearchBar;
