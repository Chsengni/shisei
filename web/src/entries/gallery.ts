// The gallery home (web/index.html): shared behaviour, the tray, the gallery itself, the assistant and the image cache.
import '../common';
import '../tray';
import '../gallery';
import { mountAgentPanel } from '../agent/panel';
import { registerSW } from '../sw-register';

mountAgentPanel();
registerSW();
