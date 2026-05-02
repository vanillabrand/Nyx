import { AutomationService } from '../src/services/AutomationService';
import dotenv from 'dotenv';

dotenv.config();

const automation = new AutomationService();
automation.start();
