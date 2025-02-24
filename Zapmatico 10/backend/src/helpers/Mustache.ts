import Mustache from "mustache";
import Contact from "../models/Contact";
import format from "date-fns/format";

export const greeting = (): string => {
  const greetings = ["Boa madrugada", "Bom dia", "Boa tarde", "Boa noite"];
  const h = new Date().getHours();
  // eslint-disable-next-line no-bitwise
  return greetings[(h / 6) >> 0];
};

const firstname = (name) => {
  if (name) {
    const nameArr = name.split(' ');
    return nameArr[0];
  }
  return '';
};

export default (body: string, contact: Contact): string => {
  let ms = "";

  const Hr = new Date();

  const dd: string = `0${Hr.getDate()}`.slice(-2);
  const mm: string = `0${Hr.getMonth() + 1}`.slice(-2);
  const yy: string = Hr.getFullYear().toString();
  const hh: number = Hr.getHours();
  const min: string = `0${Hr.getMinutes()}`.slice(-2);
  const ss: string = `0${Hr.getSeconds()}`.slice(-2);

  if (hh >= 6) {
    ms = "Bom dia";
  }
  if (hh > 11) {
    ms = "Boa tarde";
  }
  if (hh > 18) {
    ms = "Boa noite";
  }
  if (hh > 23 || hh < 6) {
    ms = "Boa madrugada";
  }

  const today = format(new Date(), "dd/MM/yyyy").replace(/\//g, '/');
  
  const protocol = yy + mm + dd + String(hh) + min + ss;


  const hora = `${hh}:${min}:${ss}`;

  console.log("protocol", format(new Date(), "dd/MM/yyyy"));


  const view = {
    name: contact ? contact.name : "",
    greeting: greeting(),
    ms,
    protocol,
    hora,
    today,
    firstname: firstname(contact ? contact.name : ""),
  };
  return Mustache.render(body, view);
};