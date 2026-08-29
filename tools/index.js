import * as webSearch from "./webSearch.js";
import * as gmail from "./gmail.js";
import * as telegram from "./telegram.js";
import * as notion from "./notion.js";
import * as browser from "./browser.js";
import * as whatsapp from "./whatsapp.js";

// Yeni bir araç eklemek için:
// 1. tools/ altına yeni bir dosya oluştur (definition + handler export et)
// 2. Aşağıdaki listeye ekle
export const tools = [
  { definition: webSearch.definition, handler: webSearch.handler },
  { definition: gmail.sendDefinition, handler: gmail.sendHandler },
  { definition: gmail.readDefinition, handler: gmail.readHandler },
  { definition: gmail.getMessageDefinition, handler: gmail.getMessageHandler },
  { definition: telegram.definition, handler: telegram.handler },
  { definition: notion.definition, handler: notion.handler },
  { definition: browser.definition, handler: browser.handler },
  { definition: whatsapp.sendDefinition, handler: whatsapp.sendHandler },
  { definition: whatsapp.readDefinition, handler: whatsapp.readHandler },
];
