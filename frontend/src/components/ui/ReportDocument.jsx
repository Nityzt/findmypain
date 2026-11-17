'use client'

import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

const NOT_MENTIONED = 'Not mentioned'

const URGENCY = {
  low: { label: 'LOW', color: '#16a34a', bg: '#f0fdf4' },
  moderate: { label: 'MODERATE', color: '#d97706', bg: '#fffbeb' },
  high: { label: 'HIGH - SEEK CARE SOON', color: '#dc2626', bg: '#fef2f2' },
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', paddingVertical: 36, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 10, color: '#2B2118' },
  header: { borderBottom: '2 solid #0F766E', paddingBottom: 10, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#0B5F58', letterSpacing: 1 },
  subtitle: { fontSize: 10, color: '#6B5D50', marginTop: 3 },
  date: { fontSize: 10, color: '#6B5D50' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0F766E', letterSpacing: 1.2, marginBottom: 6, textTransform: 'uppercase', borderBottom: '0.5 solid #D6EEEA', paddingBottom: 3 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 100, fontSize: 9.5, color: '#6B5D50', fontFamily: 'Helvetica-Bold' },
  value: { flex: 1, fontSize: 9.5, color: '#2B2118' },
  muted: { flex: 1, fontSize: 9.5, color: '#9aaabb' },
  painCard: { border: '0.5 solid #EADCCB', borderRadius: 4, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 6, backgroundColor: '#FFF9F2' },
  painRegion: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0B5F58', marginBottom: 4 },
  bullet: { flexDirection: 'row', marginBottom: 3 },
  bulletDot: { width: 14, color: '#0F766E' },
  bulletText: { flex: 1, fontSize: 9.5, lineHeight: 1.4 },
  bodyImage: { width: 150, height: 167, objectFit: 'contain', borderRadius: 4 },
  disclaimer: { marginTop: 16, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#fff8f0', border: '0.5 solid #f59e0b', borderRadius: 4, fontSize: 8.5, color: '#7a5a20', lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 18, left: 44, right: 44, fontSize: 8, color: '#9aaabb', flexDirection: 'row', justifyContent: 'space-between' },
})

function Header({ subtitle, date }) {
  return (
    <View style={styles.header} fixed>
      <View>
        <Text style={styles.title}>FINDMYPAIN</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.date}>{date}</Text>
    </View>
  )
}

function Field({ label, value }) {
  const missing = !value || value === NOT_MENTIONED
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={missing ? styles.muted : styles.value}>{missing ? 'Not mentioned' : value}</Text>
    </View>
  )
}

function Bullets({ items, numbered }) {
  return items.map((item, i) => (
    <View key={i} style={styles.bullet} wrap={false}>
      <Text style={styles.bulletDot}>{numbered ? `${i + 1}.` : '-'}</Text>
      <Text style={styles.bulletText}>{item}</Text>
    </View>
  ))
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>Patient-reported summary. Not a diagnosis.</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

export default function ReportDocument({ intake, painPoints, chatHistory, report, canvasScreenshot }) {
  const date = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
  const urgency = URGENCY[report?.urgency] || URGENCY.low
  const regions = report?.regions?.length ? report.regions : (painPoints || []).map((p) => ({ region: p.region }))

  return (
    <Document title="FindMyPain report" author="FindMyPain">
      <Page size="A4" style={styles.page}>
        <Header subtitle="Pre-appointment pain summary" date={date} />

        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Patient</Text>
              <Field label="Age" value={intake?.age} />
              <Field label="Biological sex" value={intake?.biologicalSex} />
              <Field label="Pain onset" value={intake?.painOnset} />
              <Field label="Conditions" value={intake?.chronicConditions || 'None reported'} />
              <Field label="Medications" value={intake?.medications || 'None reported'} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Urgency</Text>
              <View style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4, backgroundColor: urgency.bg, border: `1 solid ${urgency.color}` }}>
                <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: urgency.color }}>{urgency.label}</Text>
                {report?.urgencyReason ? <Text style={{ fontSize: 9, marginTop: 2 }}>{report.urgencyReason}</Text> : null}
              </View>
            </View>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          {canvasScreenshot ? <Image src={canvasScreenshot} style={styles.bodyImage} /> : null}
        </View>

        {report?.redFlags?.length > 0 && (
          <View style={[styles.section, { border: '1 solid #dc2626', borderRadius: 4, padding: 8, backgroundColor: '#fef2f2' }]} wrap={false}>
            <Text style={[styles.sectionTitle, { color: '#dc2626', borderBottom: 'none' }]}>Warning signs mentioned</Text>
            <Bullets items={report.redFlags} />
          </View>
        )}

        {report?.summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={{ fontSize: 10, lineHeight: 1.5 }}>{report.summary}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pain locations and details</Text>
          {regions.map((r, i) => (
            <View key={i} style={styles.painCard} wrap={false}>
              <Text style={styles.painRegion}>{r.region}</Text>
              <Field label="Started" value={r.onset} />
              <Field label="Feels like" value={r.character} />
              <Field label="Severity" value={r.severity} />
              <Field label="Spreads to" value={r.radiation} />
              <Field label="Worse with" value={r.aggravating} />
              <Field label="Better with" value={r.relieving} />
              <Field label="Other symptoms" value={r.associated} />
            </View>
          ))}
        </View>

        {report?.considerations?.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Possibilities for the clinician to consider</Text>
            <Bullets items={report.considerations} />
          </View>
        )}

        {report?.questionsForDoctor?.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Patient questions</Text>
            <Bullets items={report.questionsForDoctor} />
          </View>
        )}

        {report?.nextSteps?.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Suggested next steps</Text>
            <Bullets items={report.nextSteps} numbered />
          </View>
        )}

        <View style={styles.disclaimer} wrap={false}>
          <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>Important</Text>
          <Text>
            This report was generated by an AI assistant from the patient&apos;s own description. It is for
            informational purposes only and is not medical advice, diagnosis, or treatment.
          </Text>
        </View>
        <Footer />
      </Page>

      {chatHistory?.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Header subtitle="Conversation transcript" date={date} />
          {chatHistory.map((msg, i) => (
            <View key={i} style={{ marginBottom: 6 }} wrap={false}>
              <Text style={{ fontSize: 8.5, color: msg.role === 'user' ? '#0B5F58' : '#006644', fontFamily: 'Helvetica-Bold', marginBottom: 1 }}>
                {msg.role === 'user' ? 'PATIENT' : 'ASSISTANT'}
              </Text>
              <Text style={{ fontSize: 9.5, lineHeight: 1.45, paddingLeft: 8 }}>{msg.content}</Text>
            </View>
          ))}
          <Footer />
        </Page>
      )}
    </Document>
  )
}
