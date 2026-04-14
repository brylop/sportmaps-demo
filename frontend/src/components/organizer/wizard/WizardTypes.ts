export type EventWizardState = {
  step: number;
  eventInfo: {
    title: string;
    sport: string;
    description: string;
    event_date: string;
    start_time: string;
    end_time: string;
    city: string;
    address: string;
    lat?: number;
    lng?: number;
    capacity: number;
    slug: string;
    visibility: string;
    registration_type: string;
    image_url?: string;
  };
  categories: Array<{
    division: string;
    level: string;
    category: string;
    rama: string;
    min_age: number;
    max_age: number;
    min_athletes: number;
    max_athletes: number;
    base_price: number;
  }>;
  pricePhases: Array<{
    phase_name: string;
    valid_until: string;
    pkg_1_price: number;
    pkg_2_price: number;
    pkg_3_price: number;
    pkg_solo_price: number;
    kit_type: string;
    crossover_price: number;
    deposit_percentage: number;
  }>;
  rules: {
    registration_deadline: string;
    payment_deadline: string;
    kit_deadline_platino?: string;
    kit_deadline_gold?: string;
    crossover_allowed: boolean;
    free_package_every: number;
    coach_discount_usd: number;
    companion_discount_usd: number;
  };
  paymentConfig: {
    payment_methods: string[];
    referral_tracking_enabled: boolean;
  };
};

export type WizardAction =
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_STEP'; payload: number }
  | { type: 'UPDATE_EVENT_INFO'; payload: Partial<EventWizardState['eventInfo']> }
  | { type: 'UPDATE_CATEGORIES'; payload: EventWizardState['categories'] }
  | { type: 'UPDATE_PRICE_PHASES'; payload: EventWizardState['pricePhases'] }
  | { type: 'UPDATE_RULES'; payload: Partial<EventWizardState['rules']> }
  | { type: 'UPDATE_PAYMENT_CONFIG'; payload: Partial<EventWizardState['paymentConfig']> }
  | { type: 'LOAD_STATE'; payload: EventWizardState }
  | { type: 'RESET' };

export const initialWizardState: EventWizardState = {
  step: 1,
  eventInfo: {
    title: '', sport: 'Porrismo', description: '', event_date: '', start_time: '',
    end_time: '', city: '', address: '', capacity: 1000, slug: '',
    visibility: 'public', registration_type: 'delegation'
  },
  categories: [],
  pricePhases: [],
  rules: {
    registration_deadline: '', payment_deadline: '', crossover_allowed: false,
    free_package_every: 20, coach_discount_usd: 70, companion_discount_usd: 50
  },
  paymentConfig: {
    payment_methods: [], referral_tracking_enabled: false
  }
};

export function wizardReducer(state: EventWizardState, action: WizardAction): EventWizardState {
  switch (action.type) {
    case 'NEXT_STEP': return { ...state, step: Math.min(state.step + 1, 5) };
    case 'PREV_STEP': return { ...state, step: Math.max(state.step - 1, 1) };
    case 'SET_STEP': return { ...state, step: action.payload };
    case 'UPDATE_EVENT_INFO': return { ...state, eventInfo: { ...state.eventInfo, ...action.payload } };
    case 'UPDATE_CATEGORIES': return { ...state, categories: action.payload };
    case 'UPDATE_PRICE_PHASES': return { ...state, pricePhases: action.payload };
    case 'UPDATE_RULES': return { ...state, rules: { ...state.rules, ...action.payload } };
    case 'UPDATE_PAYMENT_CONFIG': return { ...state, paymentConfig: { ...state.paymentConfig, ...action.payload } };
    case 'LOAD_STATE': return action.payload;
    case 'RESET': return initialWizardState;
    default: return state;
  }
}
