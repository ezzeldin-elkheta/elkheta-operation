/**
 * Extends the RequestInit interface to include the 'duplex' property
 * which is used for streaming requests
 */
interface RequestInit {
  /**
   * The duplex option for fetch requests
   * 'half' is used for requests with a streaming body
   */
  duplex?: 'half';
}
