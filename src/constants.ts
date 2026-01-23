export const DEFAULT_API_BASE_URL = 'https://shadow.radr.fun/shadowpay/api';

export const DEFAULT_NETWORK = 'mainnet-beta';

export const TOKEN_MINTS: Record<string, string> = {
  SOL: 'Native',
  RADR: 'CzFvsLdUazabdiu9TYXujj4EY495fG7VgJJ3vQs6bonk',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  ORE: 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JIM: 'H9muD33usLGYv1tHvxCVpFwwVSn27x67tBQYH1ANbonk',
  GODL: 'GodL6KZ9uuUoQwELggtVzQkKmU1LfqmDokPibPeDKkhF',
  HUSTLE: 'HUSTLFV3U5Km8u66rMQExh4nLy7unfKHedEXVK1WgSAG',
  ZEC: '2fbBGNkpmPmPa3aTMqHV4czFUWshofxbAmrbyaVZmy7q',
  CRT: 'CRTx1JouZhzSU6XytsE42UQraoGqiHgxabocVfARTy2s',
  BLACKCOIN: 'J3rYdme789g1zAysfbH9oP4zjagvfVM2PX7KJgFDpump',
  GIL: 'CyUgNnKPQLqFcheyGV8wmypnJqojA7NzsdJjTS4nUT2j',
  ANON: 'D25bi7oHQjqkVrzbfuM6k2gzVNHTSpBLhtakDCzCCDUB',
  WLFI: 'WLFinEv6ypjkczcS83FZqFpgFZYwQXutRbxGe7oC16g',
  USD1: 'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB',
  AOL: '2oQNkePakuPbHzrVVkQ875WHeewLHCd2cAwfwiLQbonk',
  IQLABS: '3uXACfojUrya7VH51jVC1DCHq3uzK4A7g469Q954LABS',
  SANA: '5dpN5wMH8j8au29Rp91qn4WfNq6t6xJfcjQNcFeDJ8Ct',
  POKI: '6vK6cL9C66Bsqw7SC2hcCdkgm1UKBDUE6DCYJ4kubonk',
  RAIN: '3iC63FgnB7EhcPaiSaC51UkVweeBDkqu17SaRyy2pump',
  HOSICO: 'Dx2bQe2UPv4k3BmcW8G2KhaL5oKsxduM5XxLSV3Sbonk',
  SKR: 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3',
};

export const TOKEN_DECIMALS: Record<string, number> = {
  SOL: 9,
  RADR: 9,
  USDC: 6,
  ORE: 11,
  BONK: 5,
  JIM: 9,
  GODL: 11,
  HUSTLE: 9,
  ZEC: 9,
  CRT: 9,
  BLACKCOIN: 6,
  GIL: 6,
  ANON: 9,
  WLFI: 6,
  USD1: 6,
  AOL: 6,
  IQLABS: 9,
  SANA: 6,
  POKI: 9,
  RAIN: 6,
  HOSICO: 9,
  SKR: 6,
};

export const TOKEN_FEES: Record<string, number> = {
  SOL: 0.005,
  RADR: 0.003,
  HUSTLE: 0.003,
  ORE: 0.003,
  IQLABS: 0.005,
  SKR: 0.005,
  RAIN: 0.02,
  DEFAULT: 0.01,
};

export const TOKEN_MINIMUMS: Record<string, number> = {
  SOL: 100_000_000,
  USDC: 5_000_000,
  USD1: 5_000_000,
  WLFI: 10_000_000,
  ORE: 5_000_000_000,
  GODL: 500_000_000_000,
  ZEC: 100_000_000,
  AOL: 100_000_000,
  SKR: 300_000_000,
  RAIN: 5_000_000_000,
  DEFAULT: 10_000_000_000_000,
};

export const DEFAULT_PROOF_BIT_LENGTH = 64;

