'use client'

import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: '40 50',
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#1a2a3a',
  },
  header: {
    borderBottom: '2 solid #0055cc',
    paddingBottom: 12,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#0033aa',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 10,
    color: '#5580aa',
    marginTop: 3,
    letterSpacing: 0.5,
  },
  date: {
    fontSize: 10,
    color: '#6688aa',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#0055cc',
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
    borderBottom: '0.5 solid #ddeeff',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: 130,
    fontSize: 10,
    color: '#6688aa',
    fontFamily: 'Helvetica-Bold',
  },
  value: {
    flex: 1,
    fontSize: 10,
    color: '#1a2a3a',
  },
  painCard: {
    border: '0.5 solid #ccdded',
    borderRadius: 4,
    padding: '8 12',
    marginBottom: 8,
    backgroundColor: '#f7faff',
  },
  painRegion: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#003388',
    marginBottom: 5,
  },
  urgencyBadge: (urgency) => ({
    display: 'inline-flex',
    padding: '2 8',
    borderRadius: 10,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#fff',
    backgroundColor: urgency === 'high' ? '#ef4444' : urgency === 'moderate' ? '#f59e0b' : '#22c55e',
  }),
  disclaimer: {
    marginTop: 24,
    padding: '10 14',
    backgroundColor: '#fff8f0',
    border: '0.5 solid #f59e0b',
    borderRadius: 4,
    fontSize: 9,
    color: '#7a5a20',
    lineHeight: 1.6,
  },
  bodyImage: {
    width: 160,
    height: 280,
    objectFit: 'contain',
    alignSelf: 'center',
    marginVertical: 10,
  },
  bullet: {
    fontSize: 10,
    color: '#1a2a3a',
    marginBottom: 3,
    flexDirection: 'row',
  },
  bulletDot: {
    width: 12,
    color: '#0055cc',
  },
})

export default function ReportDocument({ intake, painPoints, chatHistory, assessment, canvasScreenshot }) {
  const now = new Date().toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const urgency = assessment?.urgency || 'low'
  const urgencyLabel = { low: 'LOW', moderate: 'MODERATE', high: 'HIGH — SEEK CARE SOON' }[urgency] || 'UNKNOWN'
  const urgencyColor = { low: '#22c55e', moderate: '#f59e0b', high: '#ef4444' }[urgency] || '#aaa'

  return (
    <Document>
      {/* Page 1: Patient Summary */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>FINDMYPAIN</Text>
            <Text style={styles.subtitle}>Pain Assessment Report</Text>
          </View>
          <Text style={styles.date}>{now}</Text>
        </View>

        {/* Patient info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Information</Text>
          {[
            ['Age', intake?.age || '—'],
            ['Biological Sex', intake?.biologicalSex || '—'],
            ['Pain Onset', intake?.painOnset || '—'],
            ['Chronic Conditions', intake?.chronicConditions || 'None reported'],
            ['Current Medications', intake?.medications || 'None reported'],
          ].map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.label}>{label}:</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Body image + pain sites */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pain Locations</Text>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            {canvasScreenshot && (
              <Image src={canvasScreenshot} style={styles.bodyImage} />
            )}
            <View style={{ flex: 1, paddingTop: 8 }}>
              {painPoints?.map((p, i) => (
                <View key={i} style={styles.painCard}>
                  <Text style={styles.painRegion}>{p.region}</Text>
                  <View style={styles.row}>
                    <Text style={styles.label}>Severity:</Text>
                    <Text style={styles.value}>{p.severity || 'Not specified'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Page>

      {/* Page 2: Conversation Summary */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>FINDMYPAIN</Text>
            <Text style={styles.subtitle}>Symptom Detail</Text>
          </View>
          <Text style={styles.date}>{now}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assessment Conversation</Text>
          {chatHistory?.slice(0, 20).map((msg, i) => (
            <View key={i} style={{ marginBottom: 6 }}>
              <Text style={{
                fontSize: 9,
                color: msg.role === 'user' ? '#003388' : '#006644',
                fontFamily: 'Helvetica-Bold',
                marginBottom: 2,
              }}>
                {msg.role === 'user' ? 'PATIENT' : 'AI ASSISTANT'}
              </Text>
              <Text style={{ fontSize: 10, color: '#1a2a3a', lineHeight: 1.5, paddingLeft: 8 }}>
                {msg.content}
              </Text>
            </View>
          ))}
        </View>
      </Page>

      {/* Page 3: AI Assessment */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>FINDMYPAIN</Text>
            <Text style={styles.subtitle}>AI Assessment</Text>
          </View>
          <Text style={styles.date}>{now}</Text>
        </View>

        {/* Urgency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Urgency Level</Text>
          <View style={{
            padding: '10 16', borderRadius: 6,
            backgroundColor: urgency === 'high' ? '#fff0f0' : urgency === 'moderate' ? '#fffbf0' : '#f0fff4',
            border: `1 solid ${urgencyColor}`,
          }}>
            <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: urgencyColor }}>
              {urgencyLabel}
            </Text>
          </View>
        </View>

        {/* Differentials */}
        {assessment?.differentials?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Possible Considerations</Text>
            {assessment.differentials.map((d, i) => (
              <View key={i} style={styles.bullet}>
                <Text style={styles.bulletDot}>•  </Text>
                <Text style={{ fontSize: 10 }}>{d}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Next steps */}
        {assessment?.nextSteps?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommended Next Steps</Text>
            {assessment.nextSteps.map((s, i) => (
              <View key={i} style={styles.bullet}>
                <Text style={styles.bulletDot}>{i+1}. </Text>
                <Text style={{ fontSize: 10 }}>{s}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.disclaimer}>
          <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>⚠️ Important Disclaimer</Text>
          <Text>
            This report is generated by an AI assistant and is for informational purposes only.
            It does not constitute medical advice, diagnosis, or treatment. Always consult a
            qualified healthcare professional for any health concerns or before making health-related decisions.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
