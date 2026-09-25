import Link from "next/link";
import { ArrowLeft, FileCheck2, ShieldCheck } from "lucide-react";

export const LEGAL_VERSION = "2026-09-25";
const LEGAL_VALUES: Record<string, string> = {
  LEGAL_ENTITY_NAME: process.env.LEGAL_ENTITY_NAME ?? "el proveedor de Multi-POS",
  LEGAL_ADDRESS: process.env.LEGAL_ADDRESS ?? "el domicilio informado por el proveedor",
  LEGAL_CONTACT_EMAIL: process.env.LEGAL_CONTACT_EMAIL ?? "el correo de soporte publicado en el sistema",
  PRIVACY_CONTACT_EMAIL: process.env.PRIVACY_CONTACT_EMAIL ?? process.env.LEGAL_CONTACT_EMAIL ?? "el correo de privacidad publicado en el sistema",
};
const resolveLegalText = (value: string) => Object.entries(LEGAL_VALUES).reduce((text, [token, replacement]) => text.replaceAll(token, replacement), value);
export type LegalDocumentKey = "terminos" | "privacidad" | "comercio" | "cookies";
type Section = { title: string; paragraphs: string[]; bullets?: string[] };
export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, { title: string; summary: string; sections: Section[] }> = {
  terminos: { title: "Términos de uso de Multi-POS", summary: "Reglas generales para utilizar el panel administrativo, punto de venta, cocina, agenda, reservaciones y portal.", sections: [
    { title: "1. Identificación y alcance", paragraphs: ["Estos términos regulan el uso de Multi-POS por propietarios, administradores, empleados y clientes. El proveedor legal de la plataforma debe identificarse mediante LEGAL_ENTITY_NAME y LEGAL_ADDRESS. Cada negocio que opera una tienda dentro de Multi-POS conserva la responsabilidad sobre sus productos, servicios, personal, precios y operaciones."] },
    { title: "2. Cuenta y seguridad", paragraphs: ["La cuenta es personal. La persona usuaria debe proporcionar información correcta, proteger sus credenciales y avisar de inmediato sobre accesos no autorizados. La activación por correo confirma el control de la dirección registrada."], bullets: ["No compartir contraseñas ni cuentas de caja.", "Mantener actualizados correo y teléfono.", "Asignar únicamente los permisos necesarios.", "Cerrar sesiones en dispositivos compartidos."] },
    { title: "3. Uso permitido", paragraphs: ["Multi-POS debe utilizarse para operaciones lícitas y conforme a la configuración del negocio. Quedan prohibidos el acceso no autorizado, la manipulación de importes, la interferencia con el servicio, la carga de contenido malicioso y el tratamiento de datos sin una base válida."] },
    { title: "4. Información y operaciones", paragraphs: ["El negocio es responsable de revisar catálogos, existencias, impuestos, precios, descuentos, crédito, disponibilidad, horarios y datos fiscales. Los comprobantes reflejan la información registrada por el negocio y no sustituyen obligaciones fiscales que requieran herramientas autorizadas."] },
    { title: "5. Planes y disponibilidad", paragraphs: ["El acceso puede depender del plan contratado, límites de sucursales o empleados y estado de pago. Podrán realizarse mantenimientos y cambios razonables para proteger la seguridad y continuidad. Las funciones externas dependen también de proveedores de correo, mapas, mensajería y pagos."] },
    { title: "6. Propiedad intelectual", paragraphs: ["La plataforma, interfaz y documentación pertenecen a sus respectivos titulares. El negocio conserva los derechos sobre sus marcas, catálogos, imágenes y contenido, y declara contar con autorización para cargarlos."] },
    { title: "7. Suspensión y terminación", paragraphs: ["Se podrá suspender acceso por falta de pago, riesgo de seguridad, mandato de autoridad o incumplimiento grave. Cuando corresponda, se procurará comunicar la causa y permitir la recuperación o exportación razonable de información."] },
    { title: "8. Responsabilidad y contacto", paragraphs: ["Cada parte responde por sus propias obligaciones. Ninguna cláusula limita derechos irrenunciables reconocidos por la legislación mexicana. Para soporte o asuntos legales utiliza LEGAL_CONTACT_EMAIL."] },
  ]},
  privacidad: { title: "Aviso de privacidad integral", summary: "Cómo se obtienen, utilizan, protegen y comparten los datos personales dentro de Multi-POS.", sections: [
    { title: "1. Responsable", paragraphs: ["El responsable de los datos de cada negocio y sus clientes es la persona física o moral que opera dicho negocio. El proveedor de Multi-POS actúa como encargado de la plataforma en los tratamientos realizados por cuenta del negocio. Sus datos de identidad, domicilio y contacto deben constar en la configuración de empresa, comprobantes y LEGAL_CONTACT_EMAIL."] },
    { title: "2. Datos tratados", paragraphs: ["Según las funciones utilizadas pueden tratarse datos de identificación, contacto, laborales, cuenta, compras, preferencias, lealtad, crédito, facturación, direcciones, ubicación para entregas, reservaciones, citas, pagos tokenizados, comunicaciones, archivos y datos técnicos de sesión o dispositivo. Multi-POS no requiere almacenar números completos de tarjeta ni códigos de seguridad."] },
    { title: "3. Finalidades necesarias", paragraphs: ["Los datos se utilizan para crear y proteger cuentas; operar ventas, pedidos, pagos, crédito, entregas, citas y reservaciones; administrar personal y permisos; mantener inventario e historial; emitir comprobantes; atender soporte, aclaraciones y derechos; prevenir fraude; y cumplir obligaciones legales."] },
    { title: "4. Finalidades opcionales", paragraphs: ["Con autorización separada, el negocio puede enviar promociones y comunicaciones comerciales. La negativa no debe impedir los servicios principales. El consentimiento puede retirarse mediante los controles del portal o contactando al responsable."] },
    { title: "5. Transferencias y encargados", paragraphs: ["La información puede comunicarse a proveedores de infraestructura, correo, mensajería, mapas, notificaciones y pagos para prestar sus servicios; a sucursales y personal autorizado; y a autoridades cuando exista obligación legal. Cada pasarela procesa datos financieros conforme a su propio aviso."] },
    { title: "6. Derechos ARCO y revocación", paragraphs: ["La persona titular puede solicitar acceso, rectificación, cancelación u oposición, así como revocar su consentimiento o limitar comunicaciones. La solicitud debe enviarse a PRIVACY_CONTACT_EMAIL con nombre, medio de respuesta, relación con el negocio, derecho solicitado y datos que permitan localizar el registro. Se podrá solicitar acreditación de identidad."] },
    { title: "7. Conservación y seguridad", paragraphs: ["La información se conserva durante la relación y los plazos necesarios para obligaciones operativas, fiscales, contractuales y de defensa. Se aplican controles de acceso, aislamiento por organización, cifrado en tránsito, registros y medidas de respaldo; ningún sistema ofrece riesgo cero."] },
    { title: "8. Cambios", paragraphs: ["Versión " + LEGAL_VERSION + ". Los cambios materiales se informarán en el sistema o por los medios registrados. La versión vigente estará disponible permanentemente en esta dirección."] },
  ]},
  comercio: { title: "Condiciones de compra en el portal", summary: "Información aplicable a pedidos, pagos, entregas, recolección, servicios, reservaciones y crédito.", sections: [
    { title: "1. Vendedor y oferta", paragraphs: ["El vendedor es el negocio identificado en el portal, ticket o comprobante; Multi-POS proporciona la infraestructura tecnológica. Los productos, servicios, disponibilidad, impuestos, imágenes, descripciones, restricciones y precios son definidos por ese negocio."] },
    { title: "2. Confirmación y precio", paragraphs: ["Antes de confirmar se muestran artículos, cantidades, descuentos, impuestos, envío, propina y total. El pedido queda sujeto a disponibilidad y validación de pago. Si existe una diferencia material, el negocio deberá informar y ofrecer las opciones legalmente aplicables."] },
    { title: "3. Pago y crédito", paragraphs: ["Los pagos electrónicos son procesados por la pasarela indicada. El crédito depende de habilitación, límite individual, saldo y reglas del negocio. Un intento pendiente no equivale a pago confirmado. Nunca deben enviarse datos completos de tarjeta por notas o mensajería."] },
    { title: "4. Entrega, recolección y prestación", paragraphs: ["El portal informa modalidades, costos y estimaciones disponibles. Los tiempos pueden variar por preparación, distancia, tráfico, agenda o causas ajenas. El cliente debe proporcionar datos correctos y facilitar la recepción o presentarse en el horario acordado."] },
    { title: "5. Cancelaciones, devoluciones y garantías", paragraphs: ["Las condiciones específicas deben ser informadas por el negocio según el tipo de producto o servicio y sin reducir derechos irrenunciables. Para aclaraciones se debe conservar el número de pedido y contactar al negocio mediante los datos de su perfil o comprobante."] },
    { title: "6. Promociones, puntos y crédito", paragraphs: ["Cada beneficio se sujeta a vigencia, productos participantes, mínimos, disponibilidad y límites informados. Los puntos no son dinero salvo la equivalencia configurada. Los saldos de crédito y abonos deben revisarse en el estado de cuenta del portal."] },
    { title: "7. Menores y reclamaciones", paragraphs: ["Las compras de menores requieren autorización de su madre, padre o tutor. Para una reclamación, contacta primero al negocio. También permanecen disponibles los derechos y vías ante PROFECO cuando resulten aplicables."] },
  ]},
  cookies: { title: "Cookies y almacenamiento local", summary: "Tecnologías necesarias para sesión, seguridad, preferencias y funcionamiento de la aplicación.", sections: [
    { title: "1. Tecnologías utilizadas", paragraphs: ["Multi-POS utiliza cookies de sesión y almacenamiento del navegador para autenticar, proteger formularios, recordar organización, apariencia, navegación, papel de impresión y preferencias del dispositivo. También puede usar un service worker para funciones instalables, caché controlada y notificaciones push."] },
    { title: "2. Finalidad", paragraphs: ["Estas tecnologías permiten mantener la sesión, aplicar seguridad, conservar configuraciones y operar el servicio. La versión actual no necesita cookies de publicidad comportamental para sus funciones principales."] },
    { title: "3. Control", paragraphs: ["Puedes bloquear o borrar cookies desde el navegador, aunque la autenticación y ciertas preferencias dejarán de funcionar. Los permisos de ubicación y notificaciones se administran desde el sistema operativo o navegador y pueden revocarse en cualquier momento."] },
    { title: "4. Terceros", paragraphs: ["Mapas, pasarelas de pago, correo y mensajería pueden utilizar sus propias tecnologías cuando se abren o ejecutan sus servicios. Consulta sus avisos antes de proporcionar información directamente."] },
  ]},
};

export function LegalDocument({ document }: { document: LegalDocumentKey }) {
  const data = LEGAL_DOCUMENTS[document];
  return <main className="min-h-svh bg-muted/30 px-4 py-8 sm:py-12"><article className="mx-auto max-w-3xl overflow-hidden rounded-3xl border bg-background shadow-sm">
    <header className="border-b bg-gradient-to-br from-primary/10 via-background to-background p-6 sm:p-10">
      <Link href="/legal" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Centro legal</Link>
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">{document === "privacidad" ? <ShieldCheck /> : <FileCheck2 />}</div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{data.title}</h1><p className="mt-3 leading-relaxed text-muted-foreground">{data.summary}</p>
      <p className="mt-4 text-xs text-muted-foreground">Última actualización: 25 de septiembre de 2026 · Versión {LEGAL_VERSION}</p>
    </header>
    <div className="space-y-8 p-6 sm:p-10">{data.sections.map((section) => <section key={section.title}><h2 className="text-lg font-semibold">{section.title}</h2><div className="mt-3 space-y-3 text-sm leading-7 text-foreground/80">{section.paragraphs.map((paragraph) => <p key={paragraph}>{resolveLegalText(paragraph)}</p>)}</div>{section.bullets && <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-foreground/80">{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}</section>)}</div>
  </article></main>;
}
