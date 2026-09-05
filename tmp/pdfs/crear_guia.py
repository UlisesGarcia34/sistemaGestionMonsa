from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf/Flujo_del_sistema_Monsa_MGC.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Bold', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='Arial-Bold')
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TextoMGC', fontName='Arial', fontSize=10, leading=14, spaceAfter=7, textColor=colors.HexColor('#303030')))
styles.add(ParagraphStyle(name='PasoMGC', fontName='Arial-Bold', fontSize=12, leading=16, spaceBefore=13, spaceAfter=6, keepWithNext=True))
styles.add(ParagraphStyle(name='TituloMGC', fontName='Arial-Bold', fontSize=22, leading=27, spaceAfter=10))
styles.add(ParagraphStyle(name='EtiquetaMGC', fontName='Arial-Bold', fontSize=9, leading=12, textColor=colors.HexColor('#666666'), spaceAfter=7))
styles.add(ParagraphStyle(name='CajaMGC', fontName='Arial', fontSize=9.3, leading=13, spaceAfter=0))
story=[]
def p(text): story.append(Paragraph(text,styles['TextoMGC']))
def h(text): story.append(Paragraph(text,styles['PasoMGC']))
def box(text):
    t=Table([[Paragraph(text,styles['CajaMGC'])]],colWidths=[487])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#F1F1F1')),('BOX',(0,0),(-1,-1),.5,colors.HexColor('#CCCCCC')),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9)]))
    story.extend([t,Spacer(1,8)])
def page(label,title):
    if story: story.append(PageBreak())
    story.append(Paragraph(label,styles['EtiquetaMGC']))
    story.append(Paragraph(title,styles['TituloMGC']))

page('GUÍA DE USO | 01. PREPARACIÓN COMERCIAL','Flujo del sistema Monsa')
p('Esta guía explica el funcionamiento actual del sistema de Monsa Global Cargo (MGC), incluido el MVP de embarques y KPI. Primero se preparan clientes y proveedores; después se cotiza, reserva y opera el embarque; finalmente se factura y cobra.')
box('<b>Recorrido principal</b><br/>Contactos &gt; Pricing &gt; Cotización &gt; Routing Order &gt; Booking &gt; Embarque &gt; Seguimiento &gt; Cierre &gt; Facturación &gt; Cobranza.<br/><br/>El seguimiento, los pagos a proveedores y la consulta de reportes pueden ocurrir en paralelo.')
h('1. Iniciar sesión')
p('Cada usuario entra con su cuenta y tiene un rol: Ventas, Customer Service, Operaciones, Finanzas, Contabilidad o Administrador. Actualmente, confirmar la valorización exige Ventas o Administrador; cancelar embarques exige Administrador. La matriz completa de permisos por módulo sigue pendiente.')
h('2. Registrar y activar al cliente en Contactos')
p('El cliente comienza como <b>PROSPECTO</b>. Se capturan razón social, contacto, información fiscal y condiciones de crédito. Después se valida y activa. También se define si requiere Routing Order: instrucciones formales para organizar su embarque.')
p('<b>Regla:</b> un prospecto puede recibir un estimado, pero debe estar <b>ACTIVO</b> para aceptar una cotización y avanzar.')
h('3. Registrar proveedores y tarifas')
p('En <b>Contactos &gt; Proveedores</b> se registran navieras, transportistas, agentes, coloaders y otros proveedores. En <b>Pricing</b> se cargan sus tarifas: origen, destino, modalidad, costo, moneda, vigencia y tipo (contrato, spot o basket).')
p('<b>Regla:</b> el proveedor necesita al menos una tarifa para activarse y debe estar ACTIVO para crear un booking. Pricing sirve como catálogo de apoyo; la cotización captura sus propios importes de compra y venta.')
h('4. Crear y aceptar la cotización')
p('Ventas registra cliente, vendedor, origen, destino, modalidad, Incoterm, compra estimada, venta propuesta, moneda y vigencia. Aquí nace el <b>margen estimado: venta cotizada menos compra cotizada</b>. Se presenta al cliente y, cuando este acepta, se marca como ACEPTADA.')
p('<b>Regla:</b> sin cotización aceptada no se puede crear el Routing Order ni el booking.')

page('GUÍA DE USO | 02. RESERVA Y OPERACIÓN','Del booking al seguimiento')
h('5. Recibir el Routing Order')
p('Dentro de Cotizaciones se registran las instrucciones del cliente: shipper, puertos, destino final, tipo de entrega, agente y especificaciones. El Routing Order pasa de <b>SOLICITADO</b> a <b>RECIBIDO</b>.')
p('<b>Regla:</b> el booking exige Routing Order recibido, excepto cuando el cliente está configurado para operar sin él.')
h('6. Crear y confirmar el booking')
p('En Bookings se toma la cotización aceptada, se selecciona el proveedor y se registra la referencia de reserva. El booking comienza como <b>SOLICITADO</b> y se confirma cuando el proveedor confirma el espacio o servicio.')
p('<b>Regla:</b> únicamente un booking <b>CONFIRMADO</b> puede generar un embarque.')
h('7. Abrir el embarque')
p('En <b>Embarques &gt; Nuevo embarque</b> se elige un booking confirmado que todavía no tenga un embarque asociado. Al crearlo se genera el folio MGC, se vincula con booking y cotización y se identifica cliente, shipper y modalidad. Así comienza el expediente operativo.')
p('El folio nace en ese momento. No se crean registros vacíos para reservar numeración como ocurría en el Excel.')
h('8. Completar el expediente y dar seguimiento')
p('<b>Embarques:</b> captura y consulta del expediente completo, documentación, valorización y cierre.<br/><b>Operaciones:</b> seguimiento diario, fechas, estatus del material y notificaciones.')
p('Se actualizan buque, viaje, origen, destino, ETD (salida estimada), ETA (llegada estimada), arribo real y liberación. También se capturan MBL/HBL y su estado documental.')
box('<b>Dos estados diferentes</b><br/>El estatus del material describe la situación de la carga, por ejemplo EN PUERTO. El estado del embarque describe la etapa administrativa, por ejemplo PARA_FACTURAR. El tracking no permite cambiar directamente un embarque a FACTURADO o CANCELADO.')
p('El sistema muestra arribos previstos de hoy a diez días, avisos pendientes, arribos atrasados y días en puerto cuando existen fechas suficientes.')
p('<b>Registrar no es enviar:</b> registrar una notificación deja constancia del aviso; no envía automáticamente un correo. El envío de la carta de instrucciones tiene una acción propia y requiere SMTP configurado.')

page('GUÍA DE USO | 03. CIERRE Y FACTURACIÓN','Confirmar, cerrar y facturar')
h('9. Confirmar los importes reales')
p('Ventas o Administrador confirma la <b>valorización</b>: venta real y compra real. Esto permite comparar el margen real con el estimado de la cotización.')
p('<b>Regla:</b> ninguna factura, ni proforma ni final, puede crearse sin valorización confirmada. El dashboard utiliza esos importes reales, separados por moneda, y muestra la cobertura: cuántos embarques tienen ambos importes confirmados.')
h('10. Cerrar el embarque')
p('Cuando corresponde concluir el expediente operativo, se ejecuta <b>Cerrar embarque</b>. Pasa a <b>PARA_FACTURAR</b> y el sistema puede advertir si el margen real difiere significativamente del cotizado.')
box('La advertencia de margen <b>no bloquea el cierre</b>. Tampoco se exige valorización para ejecutar el cierre, pero sí será necesaria para crear la factura. Cerrar no permite retroceder un embarque facturado o terminado, ni reactivar uno cancelado; también se bloquea si ya existe una factura final.')
h('11. Facturar en Finanzas')
p('<b>Proforma:</b> se puede generar durante el seguimiento, con valorización confirmada. No crea una cuenta por cobrar ni marca el embarque como facturado. Permanece en borrador y no se timbra.')
p('<b>Factura final:</b> requiere valorización confirmada y embarque en PARA_FACTURAR. Sigue el ciclo siguiente:')
box('<b>BORRADOR &gt; PENDIENTE_TIMBRADO &gt; TIMBRADA</b><br/><br/><b>Borrador:</b> se revisan datos fiscales, conceptos e importes.<br/><b>Pendiente de timbrado:</b> se congela la edición.<br/><b>Timbrada:</b> nace la cuenta por cobrar y el embarque pasa a FACTURADO.')
p('<b>Estado actual:</b> el timbrado y la cancelación fiscal son simulados. La integración real con un PAC (proveedor de certificación) sigue pendiente.')
h('Las siete condiciones para avanzar')
p('1. Cliente activo para cotización en firme y aceptación.<br/>2. Cotización aceptada para Routing Order y booking.<br/>3. Routing Order recibido, cuando el cliente lo requiere.<br/>4. Proveedor activo para booking.<br/>5. Booking confirmado para crear embarque y folio.<br/>6. Valorización confirmada para cualquier factura.<br/>7. Embarque cerrado en PARA_FACTURAR para factura final.')

page('GUÍA DE USO | 04. FINANZAS Y CONTROL','Cobrar, pagar y supervisar')
h('12. Cobrar al cliente y pagar a proveedores')
p('En Finanzas existen procesos separados:')
p('<b>Cuentas por cobrar:</b> registra cobros parciales o totales contra la factura. Si la factura corresponde al método PPD (pago en parcialidades o diferido), el registro del cobro genera un complemento de pago.')
p('<b>Complementos de pago:</b> permite consultar y avanzar el ciclo del complemento generado. No se captura manualmente como un alta independiente.')
p('<b>Cuentas por pagar:</b> registra obligaciones con proveedores y confirma sus pagos. Puede trabajarse durante la operación, sin esperar al cobro del cliente. No se asignan nuevas cuentas por pagar a embarques cancelados.')
h('13. Consultar reportes y controlar excepciones')
p('<b>Reportes:</b> consulta los documentos disponibles, permite imprimirlos o descargar PDF. Cada documento exige que existan los datos necesarios. Por ejemplo, un HBL requiere su número capturado y una factura final imprimible exige timbrado.')
p('<b>Dashboard:</b> muestra embarques en curso, pendientes de facturación, avisos de arribo, atrasos y margen real por moneda. Los filtros acotan los embarques y sus indicadores; la cartera general conserva su propia ventana de consulta.')
h('¿Qué ocurre si se cancela una operación?')
p('Administrador debe indicar un motivo. Se conservan el expediente, la fecha, el autor y la evidencia de cancelación. La acción se bloquea si existen facturas o cuentas por pagar vinculadas, para revisar antes su tratamiento con Finanzas. No hay reapertura desde esta pantalla.')
h('Historial y trabajo simultáneo')
p('Los cambios operativos del MVP quedan auditados. El detalle muestra los últimos 50 cambios. Si dos personas editan el mismo embarque, el sistema rechaza la versión desactualizada para impedir que una sobrescriba el trabajo de la otra. En ese caso se debe cerrar y volver a abrir el formulario para cargar la versión vigente.')
box('<b>Alcance actual</b><br/>Esta guía describe el sistema disponible. La importación del Excel, Seguros, Proveedores por embarque, bitácora manual, ampliaciones de contenedores/demoras y la matriz completa de permisos siguen pendientes. El registro de avisos no sustituye su envío y el ciclo fiscal aún utiliza timbrado simulado.')
p('Referencia interna: arquitectura del CRUD y KPI de MONSA26, sección 16; contexto del proyecto AGENTS.md. Guía preparada con base en el flujo explicado y el MVP implementado al 05 de septiembre de 2026.')

class NumberedCanvas(canvas.Canvas):
    def __init__(self,*a,**kw):
        super().__init__(*a,**kw); self.states=[]
    def showPage(self):
        self.states.append(dict(self.__dict__)); self._startPage()
    def save(self):
        total=len(self.states)
        for state in self.states:
            self.__dict__.update(state)
            self.setStrokeColor(colors.HexColor('#CCCCCC')); self.line(54,43,541,43)
            self.setFont('Arial',8); self.setFillColor(colors.HexColor('#666666'))
            self.drawString(54,30,'MGC | Guía del flujo del sistema | 05 sep 2026')
            self.drawRightString(541,30,f'Página {self._pageNumber} de {total}')
            super().showPage()
        super().save()
def header(c,doc):
    c.saveState()
    logo=ROOT/'backend/assets/logoMonsa.png'
    if logo.exists(): c.drawImage(str(logo),54,775,width=75,height=40,preserveAspectRatio=True,anchor='c',mask='auto')
    c.setFont('Arial-Bold',10); c.setFillColor(colors.HexColor('#333333')); c.drawRightString(541,801,'MONSA GLOBAL CARGO')
    c.setFont('Arial',8); c.drawRightString(541,786,'Operación comercial, embarques y finanzas')
    c.setStrokeColor(colors.HexColor('#CCCCCC')); c.line(54,766,541,766)
    c.restoreState()

doc=SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=54,leftMargin=54,topMargin=90,bottomMargin=60,title='Flujo del sistema Monsa Global Cargo',author='Monsa Global Cargo')
doc.build(story,onFirstPage=header,onLaterPages=header,canvasmaker=NumberedCanvas)
r=PdfReader(str(OUT))
assert len(r.pages)==4, f'Paginas inesperadas: {len(r.pages)}'
text='\n'.join(p.extract_text() for p in r.pages)
for s in ['1. Iniciar sesión','13. Consultar reportes','simulados','Routing Order','valorización']:
    assert s in text,s
print(f'PDF verificado: {len(r.pages)} páginas; {OUT}')
