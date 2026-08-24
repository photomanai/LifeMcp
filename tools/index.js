import * as webSearch from "./webSearch.js";
import * as gmail from "./gmail.js";
import * as telegram from "./telegram.js";
import * as notion from "./notion.js";

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
];
