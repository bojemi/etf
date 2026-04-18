import { NextRequest, NextResponse } from 'next/server';
import { runBacktest, BacktestParams } from '@/lib/backtest';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { initialCapital, customEtfs, takeProfitStrategy, params } = body;
    
    const result = await runBacktest(
      initialCapital || 1000000,
      customEtfs,
      takeProfitStrategy || '3day_high',
      params as BacktestParams
    );

    return NextResponse.json({
      success: true,
      metrics: result.metrics
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
