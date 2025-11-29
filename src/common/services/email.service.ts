import { Injectable, Logger } from '@nestjs/common';
import * as SibApiV3Sdk from '@getbrevo/brevo';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private apiInstance: SibApiV3Sdk.TransactionalEmailsApi;

  constructor() {
    // Validar variables de entorno
    if (!process.env.BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY no está configurado en variables de entorno');
    }

    // Configurar cliente de Brevo
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKey = defaultClient.authentications['api-key'];
    apiKey.apiKey = process.env.BREVO_API_KEY;

    this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    this.logger.log('Servicio de Email (Brevo) inicializado correctamente');
  }

  /**
   * Enviar código de verificación para firma electrónica
   */
  async enviarCodigoVerificacionFirma(
    emailDestino: string,
    nombreUsuario: string,
    codigo: string,
    tituloDocumento: string,
    codigoTramite: string,
    minutosExpiracion: number = 5,
  ): Promise<void> {
    try {
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

      sendSmtpEmail.sender = {
        email: process.env.BREVO_SENDER_EMAIL || 'noreply@sistema.edu.pe',
        name: process.env.BREVO_SENDER_NAME || 'Sistema de Trámites',
      };

      sendSmtpEmail.to = [
        {
          email: emailDestino,
          name: nombreUsuario,
        },
      ];

      sendSmtpEmail.subject = `Código de verificación para firma: ${codigo}`;

      sendSmtpEmail.htmlContent = this.generarPlantillaCodigoVerificacion(
        nombreUsuario,
        codigo,
        tituloDocumento,
        codigoTramite,
        minutosExpiracion,
      );

      sendSmtpEmail.textContent = `
        Hola ${nombreUsuario},
        
        Has solicitado firmar el documento: ${tituloDocumento} (${codigoTramite})
        
        Tu código de verificación es: ${codigo}
        
        Este código expira en ${minutosExpiracion} minutos.
        
        Si no solicitaste esto, ignora este mensaje.
      `;

      // Enviar email
      const response = await this.apiInstance.sendTransacEmail(sendSmtpEmail);

      this.logger.log(`Email enviado exitosamente a ${emailDestino}. MessageId: ${response.messageId}`);
    } catch (error) {
      this.logger.error(`Error al enviar email: ${error.message}`, error.stack);
      throw new Error(`Error al enviar código de verificación: ${error.message}`);
    }
  }

  /**
   * Generar plantilla HTML para el código de verificación
   */
  private generarPlantillaCodigoVerificacion(
    nombreUsuario: string,
    codigo: string,
    tituloDocumento: string,
    codigoTramite: string,
    minutosExpiracion: number,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Código de Verificación</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">
                      🔐 Verificación de Firma Electrónica
                    </h1>
                  </td>
                </tr>
                
                <!-- Contenido -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                      Hola <strong>${nombreUsuario}</strong>,
                    </p>
                    
                    <p style="color: #555555; font-size: 14px; line-height: 1.6; margin-bottom: 10px;">
                      Has solicitado firmar electrónicamente el siguiente documento:
                    </p>
                    
                    <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px;">
                      <p style="margin: 0; color: #333333; font-size: 14px;">
                        <strong>Documento:</strong> ${tituloDocumento}
                      </p>
                      <p style="margin: 5px 0 0 0; color: #666666; font-size: 13px;">
                        <strong>Código de trámite:</strong> ${codigoTramite}
                      </p>
                    </div>
                    
                    <p style="color: #555555; font-size: 14px; line-height: 1.6; margin: 30px 0 20px 0;">
                      Tu código de verificación es:
                    </p>
                    
                    <!-- Código de Verificación -->
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; margin: 20px 0; border-radius: 8px; text-align: center;">
                      <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; display: inline-block;">
                        <span style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                          ${codigo}
                        </span>
                      </div>
                    </div>
                    
                    <!-- Advertencia de expiración -->
                    <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                      <p style="margin: 0; color: #856404; font-size: 13px; text-align: center;">
                        ⏰ <strong>Este código expira en ${minutosExpiracion} minutos</strong>
                      </p>
                    </div>
                    
                    <p style="color: #555555; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                      Ingresa este código en el sistema para completar la firma electrónica del documento.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px 30px; border-top: 1px solid #e9ecef;">
                    <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 0;">
                      <strong>⚠️ Seguridad:</strong> Si no solicitaste esta verificación, ignora este mensaje. 
                      Nunca compartas este código con nadie.
                    </p>
                    <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 10px 0 0 0; text-align: center;">
                      © ${new Date().getFullYear()} Sistema de Trámites Documentarios
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Enviar email de bloqueo temporal
   */
  async enviarNotificacionBloqueoTemporal(
    emailDestino: string,
    nombreUsuario: string,
    minutosBloqueo: number,
  ): Promise<void> {
    try {
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

      sendSmtpEmail.sender = {
        email: process.env.BREVO_SENDER_EMAIL || 'noreply@sistema.edu.pe',
        name: process.env.BREVO_SENDER_NAME || 'Sistema de Trámites',
      };

      sendSmtpEmail.to = [
        {
          email: emailDestino,
          name: nombreUsuario,
        },
      ];

      sendSmtpEmail.subject = '🔒 Cuenta bloqueada temporalmente';

      sendSmtpEmail.htmlContent = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px;">
            <h2 style="color: #dc3545;">🔒 Cuenta Bloqueada Temporalmente</h2>
            <p>Hola ${nombreUsuario},</p>
            <p>Tu cuenta ha sido bloqueada temporalmente por <strong>${minutosBloqueo} minutos</strong> debido a múltiples intentos fallidos de verificación de código.</p>
            <p>Podrás intentar nuevamente después de este período.</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Si no realizaste estos intentos, por favor contacta al administrador del sistema.
            </p>
          </div>
        </body>
        </html>
      `;

      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Notificación de bloqueo enviada a ${emailDestino}`);
    } catch (error) {
      this.logger.error(`Error al enviar notificación de bloqueo: ${error.message}`);
    }
  }
}