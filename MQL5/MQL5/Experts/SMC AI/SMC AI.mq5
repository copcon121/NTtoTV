//+------------------------------------------------------------------+
//|                                                       SMC AI.mq5 |
//|           SMC EA with XGBoost ONNX inference, zone visualisation |
//|                                  Copyright 2025, MetaQuotes Ltd. |
//|                     https://www.mql5.com/en/users/johnhlomohang/ |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, MetaQuotes Ltd."
#property link      "https://www.mql5.com/en/users/johnhlomohang/"
#property version   "1.00"

#resource "\\Files\\SMConnx\\smc_filter.onnx" as uchar ExtModel[]

#include <Trade/Trade.mqh>
#include <Trade/PositionInfo.mqh>

CTrade         trade;
CPositionInfo  pos;

//+------------------------------------------------------------------+
//|  ENUMS                                                           |
//+------------------------------------------------------------------+
enum ENUM_STRATEGY  { STRAT_OB, STRAT_FVG, STRAT_BOS, STRAT_AUTO };
enum ENUM_SWING_TYPE { SWING_OB, SWING_BOS };
enum ENUM_TREND_STR { TS_WEAK, TS_MEDIUM, TS_STRONG };

//+------------------------------------------------------------------+
//|  INPUTS                                                          |
//+------------------------------------------------------------------+
input group              "═══  Strategy  ═══"
input ENUM_STRATEGY      TradeStrategy   = STRAT_AUTO;
input double             In_Lot          = 0.02;
input long               MagicNumber     = 76543;

input group              "═══  SL / TP  ═══"
enum ENUM_SLTP_MODE { PRICE_DIST, ATR_MULT };
input ENUM_SLTP_MODE     SL_Mode         = PRICE_DIST;
input double             StopLoss_Dist   = 20.0;    // SL in price units ($)
input double             TakeProfit_Dist = 50.0;    // TP in price units ($)

//--- ATR multiplier (used when SL_Mode = ATR_MULT) ---
input double             SL_ATR_Mult     = 1.5;     // SL = ATR(14) × this
input double             TP_ATR_Mult     = 3.0;     // TP = ATR(14) × this

//--- Trailing stop ---
input bool               Trail_SL           = true;
input double             Trail_TriggerDist  = 10.0;  // profit ($) needed to start trailing
input double             Trail_StepDist     = 5.0;   // trail step ($) — SL moves in this increment

input group              "═══  SMC Parameters  ═══"
input int                SwingPeriod     = 5;        // bars each side for swing
input double             Fib_Trade_lvls  = 61.8;     // OB fib retrace %
input bool               DrawBOSLines    = true;
input int                FVG_MinPoints   = 3;
input int                FVG_ScanBars    = 20;
input bool               FVG_TradeAtEQ   = true;
input bool               OneTradePerBar  = true;

input group              "═══  ONNX AI Filter  ═══"
input bool               UseAI           = true;
input double             AI_MinScore     = 0.60;    // min probability to allow trade
input double             AI_StrongScore  = 0.80;    // threshold for "Strong" trend rating
input double             AI_MediumScore  = 0.65;    // threshold for "Medium" trend rating

input group              "═══  Panel  ═══"
input int                PanelX          = 20;
input int                PanelY          = 30;
input color              PanelBG         = C'30,30,40';
input color              PanelText       = clrSilver;
input color              PanelAccent     = clrDodgerBlue;

//+------------------------------------------------------------------+
//| CONSTANTS                                                        |
//+------------------------------------------------------------------+
#define CLR_BULL_OB     clrLimeGreen
#define CLR_BEAR_OB     clrTomato
#define CLR_BULL_FVG    clrDodgerBlue
#define CLR_BEAR_FVG    clrOrange
#define CLR_BOS_BULL    clrDodgerBlue
#define CLR_BOS_BEAR    clrTomato
#define N_FEATURES      12

//+------------------------------------------------------------------+
//| GLOBALS                                                          |
//+------------------------------------------------------------------+
double   Bid, Ask;
datetime g_lastBarTime = 0;

//--- ONNX
long     g_onnx_model  = INVALID_HANDLE;
float    g_ai_score    = 0.0f;

//--- Panel state
string   g_panel_signal = "—";
string   g_panel_origin = "—";
ENUM_TREND_STR g_trend_str = TS_WEAK;

//--- OB state
struct SOrderBlock
  {
   int               direction;
   datetime          time;
   double            high, low;
  };
SOrderBlock  g_OB;
bool         g_OB_valid       = false;
datetime     g_lastOBTradeTime = 0;

//--- OB fib scratch
double   fib_high, fib_low;
datetime fib_t1, fib_t2;

//--- BOS state
double   swng_High = -1.0, swng_Low = -1.0;
datetime bos_tH = 0, bos_tL = 0;
bool     Bull_BOS_traded = false, Bear_BOS_traded = false;
datetime lastBOSTradeTime = 0;
int      lastBOSTradeDirection = 0;

//--- FVG trade guard
datetime lastFVGTradeBar = 0;


//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   if(!InitONNX())
      return INIT_FAILED;
   trade.SetExpertMagicNumber(MagicNumber);
   CreatePanel();
   UpdatePanel();
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   DeinitONNX();
   DestroyPanel();
  }

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
  {
   //--- Trail SL runs on every tick so it reacts immediately to price movement.
   ManageTrailingSL();

   //--- Signal detection and trade entry only on new bar open.
   if(!IsNewBar())
      return;

   if(TradeStrategy == STRAT_FVG || TradeStrategy == STRAT_AUTO)
      DetectAndDrawFVGs();

   if(TradeStrategy == STRAT_OB || TradeStrategy == STRAT_AUTO)
      DetectAndDrawOrderBlocks();

   if(TradeStrategy == STRAT_BOS || TradeStrategy == STRAT_AUTO)
      DetectAndDrawBOS();
  }

//+------------------------------------------------------------------+
//| HELPERS — price access                                           |
//+------------------------------------------------------------------+
double  getHigh(int i)    { return iHigh(_Symbol, _Period, i);  }
double  getLow(int i)     { return iLow(_Symbol, _Period, i);   }
double  getOpen(int i)    { return iOpen(_Symbol, _Period, i);  }
double  getClose(int i)   { return iClose(_Symbol, _Period, i); }
datetime getTime(int i)   { return iTime(_Symbol, _Period, i);  }


bool IsNewBar()
  {
   datetime t = (datetime)SeriesInfoInteger(_Symbol, _Period, SERIES_LASTBAR_DATE);
   if(g_lastBarTime == 0)
     {
      g_lastBarTime = t;
      return false;
     }
   if(g_lastBarTime != t)
     {
      g_lastBarTime = t;
      return true;
     }
   return false;
  }

//+------------------------------------------------------------------+
//|  POSITION HELPERS                                                |
//+------------------------------------------------------------------+
bool HasOpenPosition()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(pos.SelectByIndex(i))
         if(pos.Symbol() == _Symbol && pos.Magic() == MagicNumber)
            return true;
     }
   return false;
  }

//+------------------------------------------------------------------+
//|  MANAGE TRAILING SL                                              |
//+------------------------------------------------------------------+
void ManageTrailingSL()
  {
   if(!Trail_SL)
      return;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(!pos.SelectByIndex(i))
         continue;
      if(pos.Symbol() != _Symbol || pos.Magic() != MagicNumber)
         continue;

      double entry     = pos.PriceOpen();
      double current_sl = pos.StopLoss();
      double tp        = pos.TakeProfit();
      ulong  ticket    = pos.Ticket();

      Bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      Ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

      double new_sl = 0;

      if(pos.PositionType() == POSITION_TYPE_BUY)
        {
         double profit_dist = Bid - entry;
         if(profit_dist < Trail_TriggerDist)
            continue;  // not in profit enough yet

         //--- Trail: SL follows Bid minus one step
         new_sl = NormalizeDouble(Bid - Trail_StepDist, _Digits);

         //--- Only move SL if it improves (moves up)
         if(new_sl <= current_sl)
            continue;
        }
      else // SELL
        {
         double profit_dist = entry - Ask;
         if(profit_dist < Trail_TriggerDist)
            continue;

         //--- Trail: SL follows Ask plus one step
         new_sl = NormalizeDouble(Ask + Trail_StepDist, _Digits);

         //--- Only move SL if it improves (moves down)
         if(new_sl >= current_sl)
            continue;
        }

      //--- Validate new SL respects broker minimum stop distance
      double min_stop = (double)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * _Point;
      double price_ref = (pos.PositionType() == POSITION_TYPE_BUY) ? Bid : Ask;
      if(MathAbs(price_ref - new_sl) < min_stop)
         continue;

      trade.PositionModify(ticket, new_sl, tp);
      Print("[Trail] SL moved to ", DoubleToString(new_sl, _Digits),
            "  (profit dist: ",
            DoubleToString((pos.PositionType()==POSITION_TYPE_BUY)
                           ? Bid - entry : entry - Ask, 2), ")");
     }
  }

//+------------------------------------------------------------------+
//| SL / TP CALCULATOR                                               |
//+------------------------------------------------------------------+
void CalcSLTP(double &sl_dist, double &tp_dist)
  {
   if(SL_Mode == ATR_MULT)
     {
      //--- ATR(14) — simple average of last 14 true ranges
      double atr = 0;
      for(int k = 1; k <= 14; k++)
        {
         double hl  = getHigh(k) - getLow(k);
         double hpc = MathAbs(getHigh(k) - getClose(k+1));
         double lpc = MathAbs(getLow(k)  - getClose(k+1));
         atr += MathMax(hl, MathMax(hpc, lpc));
        }
      atr /= 14.0;
      if(atr <= 0)
         atr = 10.0 * _Point;   // fallback

      sl_dist = atr * SL_ATR_Mult;
      tp_dist = atr * TP_ATR_Mult;
     }
   else // PRICE_DIST — direct dollar/price distance
     {
      sl_dist = StopLoss_Dist;
      tp_dist = TakeProfit_Dist;
     }

   //--- Safety floor: SL must be at least 5× the spread / minimum stop level
   double min_stop = (double)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * _Point;
   double spread   = SymbolInfoDouble(_Symbol, SYMBOL_ASK) - SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double floor    = MathMax(min_stop, spread * 3.0);
   if(sl_dist < floor)
      sl_dist = floor;
   if(tp_dist < floor)
      tp_dist = floor;
  }

//+------------------------------------------------------------------+
//|  ONNX INIT / DEINIT                                              |
//+------------------------------------------------------------------+
bool InitONNX()
  {
   if(!UseAI)
      return true;

   //--- Load from compiled resource (embedded at compile time via #resource)
   g_onnx_model = OnnxCreateFromBuffer(ExtModel, ONNX_DEFAULT);
   if(g_onnx_model == INVALID_HANDLE)
     {
      Print("[AI] ONNX load failed (", GetLastError(), "). "
            "Ensure smc_filter.onnx was in MQL5/Files/ when you compiled.");
      return false;
     }

   //--- Dynamic shapes: input [1 × N_FEATURES], output [1 × 2] (class label + proba)
   ulong in_shape[]  = {1, N_FEATURES};
   ulong out_shape[] = {1};          // predicted label
   ulong prb_shape[] = {1, 2};       // [prob_0, prob_1]

   if(!OnnxSetInputShape(g_onnx_model, 0, in_shape))
     { Print("[AI] OnnxSetInputShape failed"); return false; }

   if(!OnnxSetOutputShape(g_onnx_model, 0, out_shape))
     { Print("[AI] OnnxSetOutputShape[0] failed"); return false; }

   if(!OnnxSetOutputShape(g_onnx_model, 1, prb_shape))
     { Print("[AI] OnnxSetOutputShape[1] failed"); return false; }

   Print("[AI] ONNX model loaded from compiled resource. Features: ", N_FEATURES);
   return true;
  }

void DeinitONNX()
  {
   if(g_onnx_model != INVALID_HANDLE)
     { OnnxRelease(g_onnx_model); g_onnx_model = INVALID_HANDLE; }
  }

//+------------------------------------------------------------------+
//| ONNX INFERENCE                                                   |
//+------------------------------------------------------------------+
float RunONNX(int signal_type,  // SIGNAL_OB=0 FVG=1 BOS=2
              int direction,    // +1 bull / -1 bear
              double zone_high,
              double zone_low,
              double entry_price)
  {
   if(!UseAI || g_onnx_model == INVALID_HANDLE)
      return 1.0f; // pass-through

   double atr14 = 0.0;
     {
      //--- Compute ATR(14) as price distance (same units as SL/TP dollars)
      double sumTR = 0;
      for(int k = 1; k <= 14; k++)
        {
         double hl  = getHigh(k) - getLow(k);
         double hpc = MathAbs(getHigh(k) - getClose(k+1));
         double lpc = MathAbs(getLow(k)  - getClose(k+1));
         sumTR += MathMax(hl, MathMax(hpc, lpc));
        }
      atr14 = sumTR / 14.0;
     }
   if(atr14 <= 0)
      atr14 = _Point;

   double zone_mid   = (zone_high + zone_low) / 2.0;
   double zone_width = zone_high - zone_low;
   int    hour       = datetime(TimeCurrent());

   //--- RSI(14) — Wilder EMA approximation
   double rsi_val = 50.0;
     {
      double gain = 0, loss = 0;
      for(int k = 1; k <= 14; k++)
        {
         double d = getClose(k) - getClose(k+1);
         if(d > 0)
            gain += d;
         else
            loss -= d;
        }
      gain /= 14;
      loss /= 14;
      if(loss > 0)
         rsi_val = 100.0 - 100.0 / (1.0 + gain / loss);
     }

   //--- ADX(14) approximation
   double adx_val = 20.0;
     {
      double pdm = 0, ndm = 0, tr_sum = 0;
      for(int k = 1; k <= 14; k++)
        {
         double up   = getHigh(k) - getHigh(k+1);
         double down = getLow(k+1) - getLow(k);
         pdm   += (up > down && up > 0)   ? up   : 0;
         ndm   += (down > up && down > 0) ? down : 0;
         double hl  = getHigh(k) - getLow(k);
         double hpc = MathAbs(getHigh(k) - getClose(k+1));
         double lpc = MathAbs(getLow(k)  - getClose(k+1));
         tr_sum += MathMax(hl, MathMax(hpc, lpc));
        }
      if(tr_sum > 0)
        {
         double pdi = 100 * pdm / tr_sum;
         double ndi = 100 * ndm / tr_sum;
         if(pdi + ndi > 0)
            adx_val = 100 * MathAbs(pdi - ndi) / (pdi + ndi);
        }
     }

   //--- Build float feature vector — order must match Python FEATURE_COLS
   vectorf features;
   features.Init(N_FEATURES);
   features[0]  = (float)(signal_type == 0 ? 1 : 0);                                     // f_signal_ob
   features[1]  = (float)(signal_type == 1 ? 1 : 0);                                     // f_signal_fvg
   features[2]  = (float)(signal_type == 2 ? 1 : 0);                                     // f_signal_bos
   features[3]  = (float)direction;                                                        // f_direction
   features[4]  = (float)MathMin(zone_width / atr14, 10.0);                               // f_zone_width_atr
   features[5]  = (float)MathMin(MathAbs(entry_price - zone_mid) / atr14, 10.0);         // f_dist_to_zone_atr
   features[6]  = (float)MathMin(MathAbs(entry_price - zone_low) / MathMax(zone_width, _Point), 1.0); // f_fib_pct
   features[7]  = (float)MathSin(2.0 * M_PI * hour / 24.0);                              // f_session_sin
   features[8]  = (float)MathCos(2.0 * M_PI * hour / 24.0);                              // f_session_cos
   features[9]  = (float)(rsi_val / 100.0);                                               // f_rsi14
   features[10] = (float)MathMin(adx_val / 100.0, 1.0);                                  // f_adx14
   features[11] = (float)MathMin((getHigh(0) - getLow(0)) / atr14, 5.0);                 // f_spread_norm

   //--- Run inference
   vectorf label_out(1), prob_out(2);
   if(!OnnxRun(g_onnx_model, ONNX_DEFAULT, features, label_out, prob_out))
     {
      Print("[AI] OnnxRun failed: ", GetLastError());
      return -1.0f;
     }

   return prob_out[1];  // probability of TP-hit
  }

//+------------------------------------------------------------------+
//| TREND STRENGTH from AI score                                     |
//+------------------------------------------------------------------+
ENUM_TREND_STR ScoreToStrength(float score)
  {
   if(score >= AI_StrongScore)
      return TS_STRONG;
   if(score >= AI_MediumScore)
      return TS_MEDIUM;
   return TS_WEAK;
  }

string StrengthToString(ENUM_TREND_STR s)
  {
   if(s == TS_STRONG)
      return "Strong";
   if(s == TS_MEDIUM)
      return "Medium";
   return "Weak";
  }

//+------------------------------------------------------------------+
//| TRADE EXECUTION                                                  |
//+------------------------------------------------------------------+
bool ExecuteTrade(ENUM_ORDER_TYPE type, string origin)
  {
   double price = (type == ORDER_TYPE_BUY)
                  ? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                  : SymbolInfoDouble(_Symbol, SYMBOL_BID);

   //--- Get SL/TP as price distances (dollars for XAUUSD)
   double sl_dist, tp_dist;
   CalcSLTP(sl_dist, tp_dist);

   double sl = (type == ORDER_TYPE_BUY) ? price - sl_dist : price + sl_dist;
   double tp = (type == ORDER_TYPE_BUY) ? price + tp_dist : price - tp_dist;
   sl = NormalizeDouble(sl, _Digits);
   tp = NormalizeDouble(tp, _Digits);

   Print("[Trade] ", (type==ORDER_TYPE_BUY?"BUY":"SELL"),
         "  Entry:", DoubleToString(price,_Digits),
         "  SL:",    DoubleToString(sl,_Digits), " (", DoubleToString(sl_dist,2), ")",
         "  TP:",    DoubleToString(tp,_Digits), " (", DoubleToString(tp_dist,2), ")",
         "  Origin:", origin);

   trade.SetExpertMagicNumber(MagicNumber);
   bool ok = trade.PositionOpen(_Symbol, type, In_Lot, price, sl, tp, "SMC-AI");

   if(ok)
     {
      g_panel_signal = (type == ORDER_TYPE_BUY) ? "Buy" : "Sell";
      g_panel_origin = origin;
      g_trend_str    = ScoreToStrength(g_ai_score);
      UpdatePanel();
     }
   return ok;
  }

//+------------------------------------------------------------------+
//|  SWING DETECTION (unified)                                       |
//+------------------------------------------------------------------+
void DetectSwingForBar(int barIndex, ENUM_SWING_TYPE type)
  {
   const int len = SwingPeriod;
   bool isSwingH = true, isSwingL = true;

   int totalBars = Bars(_Symbol, _Period);

   for(int i = 1; i <= len; i++)
     {
      int right = barIndex - i;
      int left  = barIndex + i;
      if(right < 0)
        {
         isSwingH = false;
         isSwingL = false;
         break;
        }

      if(getHigh(barIndex) <= getHigh(right))
         isSwingH = false;
      if(left < totalBars && getHigh(barIndex) < getHigh(left))
         isSwingH = false;

      if(getLow(barIndex) >= getLow(right))
         isSwingL = false;
      if(left < totalBars && getLow(barIndex) > getLow(left))
         isSwingL = false;
     }

   if(type == SWING_OB)
     {
      if(isSwingH)
        {
         fib_high = getHigh(barIndex);
         fib_t1 = getTime(barIndex);
        }
      if(isSwingL)
        {
         fib_low  = getLow(barIndex);
         fib_t2 = getTime(barIndex);
        }
     }
   else
     {
      if(isSwingH)
        {
         swng_High = getHigh(barIndex);
         bos_tH = getTime(barIndex);
        }
      if(isSwingL)
        {
         swng_Low  = getLow(barIndex);
         bos_tL = getTime(barIndex);
        }
     }
  }

//+------------------------------------------------------------------+
//|  VISUALISATION HELPERS                                           |
//+------------------------------------------------------------------+
void DrawZoneRect(string name, datetime t1, datetime t2,
                  double high, double low, color clr, string label)
  {
   //--- Rectangle
   if(ObjectFind(0, name) == -1)
      ObjectCreate(0, name, OBJ_RECTANGLE, 0, t1, high, t2, low);
   ObjectSetInteger(0, name, OBJPROP_COLOR,   clr);
   ObjectSetInteger(0, name, OBJPROP_FILL,    true);
   ObjectSetInteger(0, name, OBJPROP_BACK,    true);
   ObjectSetInteger(0, name, OBJPROP_WIDTH,   1);
   ObjectSetInteger(0, name, OBJPROP_STYLE,   STYLE_SOLID);

   //--- Centred label — placed at the midpoint time (approximate) and price
   string lbl_name = name + "_lbl";
   datetime t_mid  = t1 + (datetime)((t2 - t1) / 2);
   double   p_mid  = (high + low) / 2.0;

   if(ObjectFind(0, lbl_name) == -1)
      ObjectCreate(0, lbl_name, OBJ_TEXT, 0, t_mid, p_mid);
   ObjectSetString(0,  lbl_name, OBJPROP_TEXT,      label);
   ObjectSetInteger(0, lbl_name, OBJPROP_COLOR,     clrWhite);
   ObjectSetInteger(0, lbl_name, OBJPROP_FONTSIZE,  9);
   ObjectSetInteger(0, lbl_name, OBJPROP_ANCHOR,    ANCHOR_CENTER);
  }

//--- Update the right-side time anchor of a zone rec
void ExtendZoneRect(string name)
  {
   if(ObjectFind(0, name) == -1)
      return;
   datetime tNow = (datetime)SeriesInfoInteger(_Symbol, _Period, SERIES_LASTBAR_DATE);
   ObjectSetInteger(0, name, OBJPROP_TIME, 1, tNow);

   string lbl_name = name + "_lbl";
   if(ObjectFind(0, lbl_name) == -1)
      return;
   //--- Recentre label horizontally
   datetime t1 = (datetime)ObjectGetInteger(0, name, OBJPROP_TIME, 0);
   datetime t_mid = t1 + (datetime)((tNow - t1) / 2);
   ObjectSetInteger(0, lbl_name, OBJPROP_TIME, 0, t_mid);
  }

void DeleteZone(string name)
  {
   ObjectDelete(0, name);
   ObjectDelete(0, name + "_lbl");
  }

//--- Draw BOS trend line with direction label
void DrawBOS(const string name, datetime t1, double p1,
             datetime t2, double p2, color col, int dir)
  {
   if(ObjectFind(0, name) != -1)
      return;
   ObjectCreate(0, name, OBJ_TREND, 0, t1, p1, t2, p2);
   ObjectSetInteger(0, name, OBJPROP_COLOR, col);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 2);
   ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, false);

   string lbl = name + "_lbl";
   ObjectCreate(0, lbl, OBJ_TEXT, 0, t2, p2);
   ObjectSetInteger(0, lbl, OBJPROP_COLOR,    col);
   ObjectSetInteger(0, lbl, OBJPROP_FONTSIZE, 9);
   ObjectSetString(0,  lbl, OBJPROP_TEXT, (dir > 0) ? "BOS ↑" : "BOS ↓");
   ObjectSetInteger(0, lbl, OBJPROP_ANCHOR,
                    (dir > 0) ? ANCHOR_RIGHT_UPPER : ANCHOR_RIGHT_LOWER);
  }

//+------------------------------------------------------------------+
//|  TRADE PANEL                                                     |
//+------------------------------------------------------------------+
#define PANEL_W  220
#define PANEL_H  202
#define PANEL_LN  22   // line height

//+------------------------------------------------------------------+
//|   CREATE PANEL                                                   |
//+------------------------------------------------------------------+
void CreatePanel()
  {
   string bg = "SMC_Panel_BG";
   if(ObjectFind(0, bg) == -1)
     {
      ObjectCreate(0, bg, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, bg, OBJPROP_XDISTANCE,  PanelX);
      ObjectSetInteger(0, bg, OBJPROP_YDISTANCE,  PanelY);
      ObjectSetInteger(0, bg, OBJPROP_XSIZE,      PANEL_W);
      ObjectSetInteger(0, bg, OBJPROP_YSIZE,      PANEL_H);
      ObjectSetInteger(0, bg, OBJPROP_BGCOLOR,    PanelBG);
      ObjectSetInteger(0, bg, OBJPROP_BORDER_TYPE,BORDER_FLAT);
      ObjectSetInteger(0, bg, OBJPROP_COLOR,      PanelAccent);
      ObjectSetInteger(0, bg, OBJPROP_WIDTH,      1);
      ObjectSetInteger(0, bg, OBJPROP_BACK,       false);
      ObjectSetInteger(0, bg, OBJPROP_CORNER,     CORNER_LEFT_UPPER);
     }
  }

void PanelLabel(string name, int line, string text, color clr, int fontsize = 9)
  {
   if(ObjectFind(0, name) == -1)
     {
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_CORNER,    CORNER_LEFT_UPPER);
      ObjectSetInteger(0, name, OBJPROP_XDISTANCE, PanelX + 10);
     }
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, PanelY + 8 + line * PANEL_LN);
   ObjectSetString(0,  name, OBJPROP_TEXT,      text);
   ObjectSetInteger(0, name, OBJPROP_COLOR,     clr);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE,  fontsize);
   ObjectSetString(0,  name, OBJPROP_FONT,      "Consolas");
  }

//+------------------------------------------------------------------+
//|  UPDATE PANEL                                                    |
//+------------------------------------------------------------------+
void UpdatePanel()
  {
   CreatePanel();

   color accent  = PanelAccent;
   color txtClr  = PanelText;
   color valClr  = clrWhite;

   color strengthColor = (g_trend_str == TS_STRONG) ? clrLimeGreen
                         : (g_trend_str == TS_MEDIUM) ? clrYellow
                         :                              clrTomato;

   color signalColor   = (g_panel_signal == "Buy")  ? clrLimeGreen
                         : (g_panel_signal == "Sell") ? clrTomato
                         :                              txtClr;

   PanelLabel("SMC_P_title",  0, "  SMC AI Filter v2.1",     accent,  10);
   PanelLabel("SMC_P_sep",    1, StringFormat("%s", "─────────────────────"), txtClr, 8);
   PanelLabel("SMC_P_sig_l",  2, "Current Signal :",         txtClr);

   string sigText = g_panel_signal + "  from  " + g_panel_origin;
   PanelLabel("SMC_P_sig_v",  3, "  " + sigText,             signalColor);

   PanelLabel("SMC_P_str_l",  4, "Trend Strength :",         txtClr);
   PanelLabel("SMC_P_str_v",  5, "  " + StrengthToString(g_trend_str), strengthColor);

   string aiTxt = UseAI
                  ? StringFormat("%.2f", g_ai_score)
                  : "Disabled";
   PanelLabel("SMC_P_ai_l",   6, "AI Score       :",         txtClr);
   PanelLabel("SMC_P_ai_v",   7, "  " + aiTxt,              valClr);

   double _sl, _tp;
   CalcSLTP(_sl, _tp);
   string sltp_mode = (SL_Mode == ATR_MULT) ? "ATR" : "Fixed";
   PanelLabel("SMC_P_sl_l",   8, StringFormat("SL $%.1f  TP $%.1f  [%s]",
              _sl, _tp, sltp_mode),          txtClr);
   string trailTxt = Trail_SL
                     ? StringFormat("ON  trig:$%.1f  step:$%.1f", Trail_TriggerDist, Trail_StepDist)
                     : "OFF";
   color trailClr = Trail_SL ? clrLimeGreen : clrTomato;
   PanelLabel("SMC_P_trail_l",  9, "Trail SL       :",  txtClr);
   PanelLabel("SMC_P_trail_v", 10, "  " + trailTxt,     trailClr);
   PanelLabel("SMC_P_sep2",    11, StringFormat("%s", "─────────────────────"), txtClr, 8);
   PanelLabel("SMC_P_sym",     12, StringFormat("%-10s  Magic %-6I64d",
              _Symbol, MagicNumber),    txtClr, 8);
   ChartRedraw(0);
  }

void DestroyPanel()
  {
   string names[] =
     {
      "SMC_Panel_BG",
      "SMC_P_title","SMC_P_sep","SMC_P_sig_l","SMC_P_sig_v",
      "SMC_P_str_l","SMC_P_str_v","SMC_P_ai_l","SMC_P_ai_v",
      "SMC_P_sl_l","SMC_P_trail_l","SMC_P_trail_v","SMC_P_sep2","SMC_P_sym"
     };
   for(int i = 0; i < ArraySize(names); i++)
      ObjectDelete(0, names[i]);
  }

//+------------------------------------------------------------------+
//|  ORDER BLOCK STRATEGY                                            |
//+------------------------------------------------------------------+
static datetime s_OB_lastDetect = 0;
void DetectAndDrawOrderBlocks()
  {
   datetime lastBar = (datetime)SeriesInfoInteger(_Symbol, _Period, SERIES_LASTBAR_DATE);

   //--- Reset OB on new bar
   if(s_OB_lastDetect != lastBar)
     {
      g_OB_valid      = false;
      s_OB_lastDetect = lastBar;
     }

   //--- Scan for a fresh OB candidate
   if(!g_OB_valid)
     {
      for(int i = 1; i < 100; i++)
        {
         //--- Bullish OB
         if(getOpen(i) < getClose(i) &&
            getOpen(i+2) < getClose(i+2) &&
            getOpen(i+3) > getClose(i+3) &&
            getOpen(i+3) < getClose(i+2))
           {
            g_OB.direction = 1;
            g_OB.time      = getTime(i+3);
            g_OB.high      = getHigh(i+3);
            g_OB.low       = getLow(i+3);
            g_OB_valid     = true;
            break;
           }
         //--- Bearish OB
         if(getOpen(i) > getClose(i) &&
            getOpen(i+2) > getClose(i+2) &&
            getOpen(i+3) < getClose(i+3) &&
            getOpen(i+3) > getClose(i+2))
           {
            g_OB.direction = -1;
            g_OB.time      = getTime(i+3);
            g_OB.high      = getHigh(i+3);
            g_OB.low       = getLow(i+3);
            g_OB_valid     = true;
            break;
           }
        }
     }

   if(!g_OB_valid)
      return;
   if(g_lastOBTradeTime == g_OB.time)
      return; // already traded this signal
   if(HasOpenPosition())
      return; // wait for current trade to close

   Bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   Ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

   bool inBull = (g_OB.direction > 0 && Ask <= g_OB.high && Ask >= g_OB.low);
   bool inBear = (g_OB.direction < 0 && Bid >= g_OB.low  && Bid <= g_OB.high);

   if(!inBull && !inBear)
      return;

   //--- Draw zone rectangle NOW (price within the zone)
   datetime tNow = lastBar;
   string   rectName = "OB_ZONE_" + TimeToString(g_OB.time);

   if(inBull)
     {
      DrawZoneRect(rectName, g_OB.time, tNow, g_OB.high, g_OB.low,
                   CLR_BULL_OB, "Bullish OB");
     }
   else
     {
      DrawZoneRect(rectName, g_OB.time, tNow, g_OB.high, g_OB.low,
                   CLR_BEAR_OB, "Bearish OB");
     }

   //--- Find most-recent swing H and L
   double   bestH = 0, bestL = 0;
   datetime bestHT = 0, bestLT = 0;

   for(int i = 0; i < 50; i++)
     {
      fib_high = 0;
      fib_low = 0;
      fib_t1 = 0;
      fib_t2 = 0;
      DetectSwingForBar(i, SWING_OB);
      if(fib_high > 0 && (bestHT == 0 || fib_t1 > bestHT))
        {
         bestH = fib_high;
         bestHT = fib_t1;
        }
      if(fib_low  > 0 && (bestLT == 0 || fib_t2 > bestLT))
        {
         bestL = fib_low;
         bestLT = fib_t2;
        }
     }
   if(bestHT == 0 || bestLT == 0)
      return;

   //--- Fibonacci validation
   if(inBull)
     {
      double entLvl = bestH - (bestH - bestL) * (Fib_Trade_lvls / 100.0);
      if(Ask > entLvl)
         return; // not deep enough

      //--- AI filter
      g_ai_score = RunONNX(0, 1, g_OB.high, g_OB.low, Ask);
      if(UseAI && g_ai_score < AI_MinScore)
        {
         Print("[AI] OB Bull signal rejected — score: ", DoubleToString(g_ai_score, 3));
         return;
        }

      g_trend_str = ScoreToStrength(g_ai_score);
      ExecuteTrade(ORDER_TYPE_BUY, "OB");
      g_lastOBTradeTime = g_OB.time;
      g_OB_valid = false;
     }
   else // inBear
     {
      double entLvl = bestL + (bestH - bestL) * (Fib_Trade_lvls / 100.0);
      if(Bid < entLvl)
         return;

      g_ai_score = RunONNX(0, -1, g_OB.high, g_OB.low, Bid);
      if(UseAI && g_ai_score < AI_MinScore)
        {
         Print("[AI] OB Bear signal rejected — score: ", DoubleToString(g_ai_score, 3));
         return;
        }

      g_trend_str = ScoreToStrength(g_ai_score);
      ExecuteTrade(ORDER_TYPE_SELL, "OB");
      g_lastOBTradeTime = g_OB.time;
      g_OB_valid = false;
     }
  }

//+------------------------------------------------------------------+
//|  FVG STRATEGY                                                    |
//+------------------------------------------------------------------+
struct SFVG
  {
   int               dir;
   datetime          tLeft;
   double            top, bot;
   string            Name() const
     {
      return (dir > 0 ? "FVG_B_" : "FVG_S_")
             + TimeToString(tLeft, TIME_DATE|TIME_MINUTES)
             + "_" + IntegerToString((int)(top * 1e5));
     }
  };

//+------------------------------------------------------------------+
//|  DRAW FVG                                                        |
//+------------------------------------------------------------------+
void DrawFVGBackground(const SFVG &z)
  {
//--- Background rectangle — extends to current bar
   string bg = z.Name() + "_bg";
   datetime tNow = (datetime)SeriesInfoInteger(_Symbol, _Period, SERIES_LASTBAR_DATE);
   if(ObjectFind(0, bg) == -1)
      ObjectCreate(0, bg, OBJ_RECTANGLE, 0, z.tLeft, z.top, tNow, z.bot);
   else
      ObjectSetInteger(0, bg, OBJPROP_TIME, 1, tNow);
   color clr = (z.dir > 0) ? C'20,50,90' : C'80,40,20'; // subtle background
   ObjectSetInteger(0, bg, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, bg, OBJPROP_FILL,  true);
   ObjectSetInteger(0, bg, OBJPROP_BACK,  true);
  }

void DrawFVGZone(const SFVG &z)
  {
   //--- Called only when price enters the gap
   datetime tNow = (datetime)SeriesInfoInteger(_Symbol, _Period, SERIES_LASTBAR_DATE);
   string name = z.Name();
   color clr = (z.dir > 0) ? CLR_BULL_FVG : CLR_BEAR_FVG;
   string lbl = (z.dir > 0) ? "Bullish FVG" : "Bearish FVG";
   DrawZoneRect(name, z.tLeft, tNow, z.top, z.bot, clr, lbl);
  }

void DetectAndDrawFVGs()
  {
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   int    maxBars = MathMin(FVG_ScanBars, Bars(_Symbol, _Period)) - 2;

   Bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   Ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

   datetime barNow = (datetime)SeriesInfoInteger(_Symbol, _Period, SERIES_LASTBAR_DATE);
   if(OneTradePerBar && lastFVGTradeBar == barNow)
      return;
   if(HasOpenPosition())
      return; // wait for current trade to close

   for(int i = 2; i < maxBars; i++)
     {
      double lowA  = getLow(i+2),  highA = getHigh(i+2);
      double highC = getHigh(i),   lowC  = getLow(i);

      SFVG z;
      bool found = false;

      if(lowA > highC && (lowA - highC) >= FVG_MinPoints * point)
        {
         z.dir = 1;
         z.tLeft = getTime(i+2);
         z.top = lowA;
         z.bot = highC;
         found = true;
        }
      else
         if(highA < lowC && (lowC - highA) >= FVG_MinPoints * point)
           {
            z.dir = -1;
            z.tLeft = getTime(i+2);
            z.top = lowC;
            z.bot = highA;
            found = true;
           }

      if(!found)
         continue;

      double mid = (z.top + z.bot) * 0.5;
      bool inGap = false;

      if(z.dir == 1)
         inGap = (Ask <= z.top && Ask >= z.bot && (!FVG_TradeAtEQ || Ask <= mid));
      else
         inGap = (Bid <= z.top && Bid >= z.bot && (!FVG_TradeAtEQ || Bid >= mid));

      if(!inGap)
         continue;

      //--- Draw coloured zone only when price enters
      DrawFVGZone(z);

      //--- AI filter
      double entry = (z.dir == 1) ? Ask : Bid;
      g_ai_score = RunONNX(1, z.dir, z.top, z.bot, entry);
      if(UseAI && g_ai_score < AI_MinScore)
        {
         Print("[AI] FVG signal rejected — score: ", DoubleToString(g_ai_score, 3));
         continue;
        }

      g_trend_str = ScoreToStrength(g_ai_score);

      if(z.dir == 1)
         ExecuteTrade(ORDER_TYPE_BUY,  "FVG");
      else
         ExecuteTrade(ORDER_TYPE_SELL, "FVG");

      lastFVGTradeBar = barNow;
      break;
     }
  }

//+------------------------------------------------------------------+
//|  BOS STRATEGY                                                    |
//+------------------------------------------------------------------+
void DetectAndDrawBOS()
  {
   double   bestH = -1, bestL = -1;
   datetime bestHT = 0, bestLT = 0;

   for(int i = 0; i < 50; i++)
     {
      swng_High = 0;
      swng_Low = 0;
      bos_tH = 0;
      bos_tL = 0;
      DetectSwingForBar(i, SWING_BOS);

      if(swng_High > 0 && (bestHT == 0 || bos_tH > bestHT))
        { bestH = swng_High; bestHT = bos_tH; }
      if(swng_Low > 0 && (bestLT == 0 || bos_tL > bestLT))
        { bestL = swng_Low;  bestLT = bos_tL; }
     }

   if(bestHT > 0)
     {
      if(bos_tH != bestHT)
         Bull_BOS_traded = false;
      swng_High = bestH;
      bos_tH = bestHT;
     }
   if(bestLT > 0)
     {
      if(bos_tL != bestLT)
         Bear_BOS_traded = false;
      swng_Low = bestL;
      bos_tL = bestLT;
     }

   Bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   Ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   datetime currentBar = getTime(0);

   if(HasOpenPosition())
      return; // wait for current trade to close

   //--- BUY on break above swing high
   if(swng_High > 0 && Ask > swng_High && !Bull_BOS_traded)
     {
      if(lastBOSTradeTime != currentBar || lastBOSTradeDirection != 1)
        {
         g_ai_score = RunONNX(2, 1, swng_High + 5 * _Point, swng_High - 5 * _Point, Ask);
         if(!UseAI || g_ai_score >= AI_MinScore)
           {
            if(DrawBOSLines)
               DrawBOS("BOS_H_" + TimeToString(bos_tH), bos_tH, swng_High,
                       TimeCurrent(), swng_High, CLR_BOS_BULL, 1);
            g_trend_str = ScoreToStrength(g_ai_score);
            ExecuteTrade(ORDER_TYPE_BUY, "BOS");
            lastBOSTradeTime      = currentBar;
            lastBOSTradeDirection = 1;
            Bull_BOS_traded       = true;
            swng_High             = -1.0;
           }
         else
            Print("[AI] BOS Bull rejected — score: ", DoubleToString(g_ai_score, 3));
        }
     }

   //--- SELL on break below swing low
   if(swng_Low > 0 && Bid < swng_Low && !Bear_BOS_traded)
     {
      if(lastBOSTradeTime != currentBar || lastBOSTradeDirection != -1)
        {
         g_ai_score = RunONNX(2, -1, swng_Low + 5 * _Point, swng_Low - 5 * _Point, Bid);
         if(!UseAI || g_ai_score >= AI_MinScore)
           {
            if(DrawBOSLines)
               DrawBOS("BOS_L_" + TimeToString(bos_tL), bos_tL, swng_Low,
                       TimeCurrent(), swng_Low, CLR_BOS_BEAR, -1);
            g_trend_str = ScoreToStrength(g_ai_score);
            ExecuteTrade(ORDER_TYPE_SELL, "BOS");
            lastBOSTradeTime      = currentBar;
            lastBOSTradeDirection = -1;
            Bear_BOS_traded       = true;
            swng_Low              = -1.0;
           }
         else
            Print("[AI] BOS Bear rejected — score: ", DoubleToString(g_ai_score, 3));
        }
     }
  }

//+------------------------------------------------------------------+
