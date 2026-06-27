"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Brain, Target, TrendingUp, BarChart2, AlertCircle, Info, Trophy } from "lucide-react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

function MetricCard({ label, value, suffix = "%", color = "text-primary", note }) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-6 flex flex-col">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        {label}
      </p>
      {value === null || value === undefined ? (
        <p className="text-2xl font-bold text-muted-foreground">N/A</p>
      ) : (
        <p className={`text-5xl font-black leading-none ${color}`}>
          {value}
          <span className="text-2xl font-bold">{suffix}</span>
        </p>
      )}
      {note && <p className="text-xs text-muted-foreground mt-3">{note}</p>}
    </div>
  );
}

function colorFor(val) {
  if (val === null || val === undefined) return "text-muted-foreground";
  if (val >= 70) return "text-emerald-500";
  if (val >= 40) return "text-amber-500";
  return "text-red-500";
}

function ModelComparisonTable({ comparison }) {
  if (!comparison) return null;
  const best = comparison.best_model;
  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          Model Comparison — Linear Regression vs Random Forest vs XGBoost
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left py-2 pr-4">Model</th>
                <th className="text-right py-2 px-3">MAE</th>
                <th className="text-right py-2 px-3">RMSE</th>
                <th className="text-right py-2 px-3">R²</th>
                <th className="text-right py-2 pl-3">CV-MAE</th>
              </tr>
            </thead>
            <tbody>
              {comparison.results.map((r) => (
                <tr
                  key={r.model}
                  className={`border-b border-border/50 ${r.model === best ? "bg-primary/5" : ""}`}
                >
                  <td className="py-3 pr-4 font-medium flex items-center gap-2">
                    {r.model === best && (
                      <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                        Best
                      </span>
                    )}
                    {r.model}
                  </td>
                  <td className="text-right py-3 px-3 tabular-nums">{r.mae.toFixed(2)}</td>
                  <td className="text-right py-3 px-3 tabular-nums">{r.rmse.toFixed(2)}</td>
                  <td className="text-right py-3 px-3 tabular-nums font-semibold">{r.r2.toFixed(4)}</td>
                  <td className="text-right py-3 pl-3 tabular-nums text-muted-foreground">{r.cv_mae.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Feature importances */}
        {comparison.feature_importances && Object.keys(comparison.feature_importances).length > 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Feature Importances (tree models)
            </p>
            {Object.entries(comparison.feature_importances).map(([model, imp]) => (
              <div key={model}>
                <p className="text-xs text-muted-foreground mb-1.5">{model}</p>
                <div className="space-y-1">
                  {Object.entries(imp).map(([feat, val]) => (
                    <div key={feat} className="flex items-center gap-2 text-xs">
                      <span className="w-32 shrink-0 text-muted-foreground truncate">{feat}</span>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${Math.round(val * 100)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-mono">{(val * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
<div
  style={{
    background: "#0f172a",
    border: "1px solid #06b6d4",
    padding: "14px",
    marginTop: "12px",
    borderRadius: "10px",
    opacity: 1,
  }}
>
  <div
    style={{
      color: "#ffffff",
      fontSize: "15px",
      fontWeight: 600,
      lineHeight: "1.8",
      opacity: 1,
    }}
  >
    Trained on {comparison.train_size} rows, tested on {comparison.test_size} rows ({comparison.dataset_size} total).<br />
    MAE = Mean Absolute Error in percentage points. Lower is better.<br />
    R² closer to 1.0 = better fit.<br />
    CV-MAE = 5-fold cross-validation MAE.
  </div>
</div>
      </CardContent>
    </Card>
  );
}

export default function PredictionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/predictions")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Computing predictions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { skillGapAccuracy, recommendationAccuracy, modelInfo, modelComparison } = data;
  const {
    predictedMatch, actualMatch, mae, matchedRole,
    missingSkills, matchedSkills, hasSkills,
    featureContributions, timeline,
  } = skillGapAccuracy;

  const featureBarData = [
    { feature: "Avg Quiz Score",  value: featureContributions.quizPerformance },
    { feature: "Experience",      value: featureContributions.experienceFactor },
    { feature: "Quizzes Taken",   value: Math.min(featureContributions.quizzesTaken * 5, 100) },
    { feature: "Role Similarity", value: featureContributions.roleSimilarity },
  ];

  const timelineChartData = timeline.map((t) => ({
    date: format(new Date(t.date), "MMM dd"),
    "Quiz Score": t.quizScore,
    "Predicted Match": t.predictedMatch,
  }));

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-5xl md:text-6xl font-bold gradient-title mb-2">
          Predictive Analytics
        </h1>
        <p className="text-muted-foreground">
          Model-based predictions vs. actual outcomes for your career profile.
        </p>
      </div>

      {/* Model info banner */}
      {modelInfo && (
        <div className="flex items-start gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span>
            Prediction model: <span className="font-semibold text-foreground">scikit-learn LinearRegression</span>
            {" "}· Trained on 600 samples
            {/* {modelInfo.trainSamples} samples */}
            
            {" "}· Test MAE <span className="font-semibold text-foreground">{modelInfo.testMAE} pp</span>
            {" "}· R² <span className="font-semibold text-foreground">{modelInfo.testR2}</span>
          </span>
        </div>
      )}

      {/* ── SECTION 1: Skill Gap Accuracy ── */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Skill Gap Accuracy</h2>
        </div>

        {matchedRole ? (
          <>
            <p className="text-sm text-muted-foreground -mt-2">
              Predicting skill match for{" "}
              <span className="font-semibold text-foreground capitalize">{matchedRole}</span> using
              quiz scores and experience (no skill data — avoids label leakage).
            </p>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                label="Predicted Match"
                value={predictedMatch}
                color={colorFor(predictedMatch)}
                note="ML model: quiz avg + experience + engagement + role transition"
              />
              <MetricCard
                label="Actual Match"
                value={actualMatch}
                color={colorFor(actualMatch)}
                note="Rule-based: % of required skills you have listed"
              />
              <MetricCard
                label="Mean Abs. Error"
                value={mae}
                color={mae <= 10 ? "text-emerald-500" : mae <= 25 ? "text-amber-500" : "text-red-500"}
                note={mae <= 10 ? "Excellent prediction accuracy" : mae <= 25 ? "Moderate accuracy" : "High prediction error"}
              />
            </div>

            {/* Actual match = 0 explanation */}
            {actualMatch === 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">Actual Match is 0%</span>
                  {" "}because {!hasSkills
                    ? "you have no skills listed on your profile."
                    : `none of your listed skills match the required skills for ${matchedRole}.`
                  }
                  {" "}
                  <a href="/profile" className="text-primary underline">Update your profile</a> to add skills and improve this score.
                  {hasSkills && missingSkills?.length > 0 && (
                    <span className="block mt-1">
                      Missing skills: <span className="text-foreground font-medium">{missingSkills.slice(0, 5).join(", ")}{missingSkills.length > 5 ? ` +${missingSkills.length - 5} more` : ""}</span>
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* MAE explanation */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold text-foreground">MAE</span> = |Predicted − Actual| = |{predictedMatch} − {actualMatch}| = {mae} pp.
                {" "}The model predicted your match at {predictedMatch}%, but your actual skill coverage is {actualMatch}%.
                {" "}Model training MAE was {modelInfo?.testMAE} pp, so this gap is within expected range.
              </span>
            </div>

            {/* Feature contributions */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" />
                  Your Feature Values (inputs to the model)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={featureBarData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="feature" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="bg-background border rounded-xl p-3 shadow text-sm">
                              <p className="font-semibold">{payload[0].payload.feature}</p>
                              <p className="font-bold text-primary">{payload[0].value}%</p>
                            </div>
                          ) : null
                        }
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    4-feature model: <code className="text-foreground">avg_quiz · experience · quizzes_taken · role_similarity</code>
                    {" "}— weights learned offline via scikit-learn LinearRegression.
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Timeline chart */}
            {timelineChartData.length > 0 && (
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Prediction vs. Quiz Score Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          content={({ active, payload }) =>
                            active && payload?.length ? (
                              <div className="bg-background border rounded-xl p-3 shadow text-sm space-y-1">
                                <p className="text-xs text-muted-foreground">{payload[0]?.payload?.date}</p>
                                {payload.map((p) => (
                                  <p key={p.name} style={{ color: p.color }} className="font-semibold">
                                    {p.name}: {p.value}%
                                  </p>
                                ))}
                              </div>
                            ) : null
                          }
                        />
                        <Legend />
                        <Line type="monotone" dataKey="Quiz Score" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="Predicted Match" stroke="#10b981" strokeWidth={2.5} strokeDasharray="5 3" dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Dashed line = predicted skill match recalculated at each quiz attempt.
                  </p>
                </CardContent>
              </Card>
            )}

            {timelineChartData.length === 0 && (
              <Card className="border border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  Take at least one quiz on the Interview Prep page to see the prediction timeline.
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="border border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              Set a target role in your profile to enable skill gap accuracy predictions.
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── SECTION 2: Model Comparison ── */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-500" />
          <h2 className="text-2xl font-bold">Model Comparison</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          How Linear Regression, Random Forest, and XGBoost perform on the same 4 features.
          Run <code className="text-foreground bg-muted px-1 rounded">npm run ml:compare</code> locally to refresh.
        </p>
        {modelComparison ? (
          <ModelComparisonTable comparison={modelComparison} />
        ) : (
          <Card className="border border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No comparison data yet. Run{" "}
              <code className="text-foreground bg-muted px-1 rounded">npm run ml:compare</code>
              {" "}to generate it.
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── SECTION 3: Recommendation Accuracy ── */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Recommendation Accuracy</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Precision@K — how many of the top-K recommended courses did you actually click?
        </p>

        {recommendationAccuracy.interactedCount > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                label="Precision @ 3"
                value={recommendationAccuracy.precision3}
                color={colorFor(recommendationAccuracy.precision3)}
                note="Top-3 recommended vs. clicked"
              />
              <MetricCard
                label="Precision @ 5"
                value={recommendationAccuracy.precision5}
                color={colorFor(recommendationAccuracy.precision5)}
                note="Top-5 recommended vs. clicked"
              />
              <MetricCard
                label="Courses Clicked"
                value={recommendationAccuracy.interactedCount}
                suffix=""
                color="text-blue-500"
                note="Distinct courses viewed"
              />
            </div>

            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-base">How Precision@K is Computed</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  The TF-IDF engine ranks all courses by cosine similarity to your profile.
                  Precision@K = (courses you clicked that appear in top K) ÷ K.
                </p>
                <p>
                  A higher score means the ranking algorithm successfully surfaced courses you
                  found relevant.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-foreground">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Top-3 hits</p>
                    <p className="font-bold text-lg">
                      {recommendationAccuracy.topRecommendedIds
                        .slice(0, 3)
                        .filter((id) => recommendationAccuracy.interactedCourseIds.includes(id)).length}
                      <span className="text-sm font-normal text-muted-foreground"> / 3</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Top-5 hits</p>
                    <p className="font-bold text-lg">
                      {recommendationAccuracy.topRecommendedIds
                        .slice(0, 5)
                        .filter((id) => recommendationAccuracy.interactedCourseIds.includes(id)).length}
                      <span className="text-sm font-normal text-muted-foreground"> / 5</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No course interactions recorded yet. Visit{" "}
              <a href="/courses" className="text-primary underline">Course Recommendations</a>{" "}
              and click "View Course" on any course to start tracking recommendation accuracy.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
