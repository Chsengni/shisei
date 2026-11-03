// A library page (web/library.html).
import '../common';
import '../tray';
import '../library';
import { mountAgentPanel } from '../agent/panel';
import { registerSW } from '../sw-register';

mountAgentPanel();
registerSW();
