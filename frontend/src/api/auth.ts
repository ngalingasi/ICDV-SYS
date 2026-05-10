import client from './client';
import type { AuthResponse, OtpChannel, AuthTokens } from '../types';

export const authApi = {
  login: (login: string, password: string) =>
    client.post<AuthResponse>('/auth/login', { login, password }),

  logout: (refreshToken: string) =>
    client.post('/auth/logout', { refreshToken }),

  refreshTokens: (refreshToken: string) =>
    client.post<AuthTokens>('/auth/refresh-tokens', { refreshToken }),

  forgotPassword: (email: string) =>
    client.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    client.post('/auth/reset-password', { password }, { params: { token } }),

  changePassword: (currentPassword: string, newPassword: string) =>
    client.post('/auth/change-password', { currentPassword, newPassword }),

  getMe: () =>
    client.get('/auth/me'),

  // OTP 3-step flow
  validateCredentials: (login: string, password: string) =>
    client.post<{ status: boolean; channels?: OtpChannel[]; must_change_password?: boolean; message: string }>(
      '/auth/validate-credentials', { login, password }
    ),

  sendOtp: (login: string, channel: 'email' | 'sms') =>
    client.post<{ status: boolean; maskedContact: string; channel: string; message: string }>(
      '/auth/send-otp', { login, channel }
    ),

  verifyOtp: (login: string, otp: string) =>
    client.post<AuthResponse>('/auth/verify-otp', { login, otp }),
};
